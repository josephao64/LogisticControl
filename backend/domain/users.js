const { createHash, randomUUID } = require('node:crypto');
const { can, fail } = require('./logistics');
const roles = ['Administrador', 'Logistica', 'Bodega', 'Tienda', 'Gerencia', 'Auditoria'];

function normalizeIdentifier(raw) {
  fail(typeof raw === 'string' && raw.trim(), 'Usuario o correo obligatorio.');
  const clean = raw.trim().toLowerCase();
  if (clean.includes('@')) {
    fail(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean), 'Correo inválido.');
    return { email: clean, username: clean.split('@')[0] };
  }
  const slug = clean
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  fail(slug.length >= 2, 'Nombre de usuario inválido.');
  return { email: `${slug}@logisticcontrol.local`, username: clean };
}

function toFirebasePassword(raw) {
  fail(
    typeof raw === 'string' && raw.length >= 3 && raw.length <= 128,
    'La contraseña debe tener entre 3 y 128 caracteres.',
  );
  return raw.length < 6 ? `lc#pwd#${raw}` : raw;
}

function createUsers(repo, auth) {
  async function validate(tx, body) {
    fail(roles.includes(body.role), 'Rol inválido.');
    fail(typeof body.name === 'string' && body.name.trim(), 'Nombre obligatorio.');
    fail(Array.isArray(body.companyIds) && Array.isArray(body.branchIds), 'Asigne empresas y sucursales.');
    const data = {name: body.name.trim(), role: body.role, active: body.active !== false,
      allBranches: Boolean(body.role === 'Bodega' && body.allBranches),
      companyIds: [...new Set(body.companyIds)], branchIds: [...new Set(body.branchIds)]};
    const companies = await tx.list('empresas'), branches = await tx.list('sucursales');
    fail(data.companyIds.every(id => companies.some(c => c.id === id && c.active !== false)), 'Empresa inválida o inactiva.');
    fail(data.branchIds.every(id => branches.some(b => b.id === id && b.active !== false && data.companyIds.includes(b.id_empresa))), 'La sucursal debe estar activa y pertenecer a una empresa autorizada.');
    fail(data.role === 'Administrador' || data.allBranches || !data.active || (data.companyIds.length && data.branchIds.length), 'Asigne al menos una empresa y una sucursal al usuario.');
    return data;
  }
  const audit = (tx, actor, id, before, after, action) => tx.set('auditEvents', randomUUID(), {
    entityType: 'users', entityId: id, actorId: actor.uid, before, after, action, at: new Date().toISOString()
  });
  return {
    async create(actor, body, operationId) {
      can(actor, ['Administrador']);
      fail(typeof operationId === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(operationId), 'Identificador de operación inválido.');
      const { email, username } = normalizeIdentifier(body.email || body.name);
      const firebasePassword = toFirebasePassword(body.password);
      const id = 'lc_' + createHash('sha256').update(actor.uid + ':' + operationId).digest('hex').slice(0, 40);
      const data = await repo.transaction(tx => validate(tx, body));
      let account;
      try { account = await auth.createUser({uid: id, email, password: firebasePassword, displayName: data.name, disabled: true}); }
      catch (e) {
        if (['auth/uid-already-exists','auth/email-already-exists'].includes(e.code)) {
          try { account = await auth.getUser(id); }
          catch { fail(false, 'Este usuario o correo ya tiene una cuenta. Edite su acceso existente.', 409); }
        }
        else { fail(false, e.code === 'auth/email-already-exists' ? 'Este usuario ya tiene una cuenta. Edite su acceso existente.' : 'No se pudo crear la cuenta. Verifique los datos y la configuración de Authentication.'); }
      }
      fail(account.email?.toLowerCase() === email, 'La operación pertenece a otro usuario.', 409);
      // Provision disabled first: failures never grant access. The same operation can be retried.
      const existing = await repo.transaction(async tx => {
        const before = await tx.get('users', id);
        if (before && !before.provisioning) return before;
        await validate(tx, body);
        tx.set('users', id, {...data, email, username, active: false, provisioning: true});
        return null;
      });
      if (existing) return {id, ...existing};
      await auth.updateUser(id, {disabled: !data.active, displayName: data.name});
      return repo.transaction(async tx => {
        const before = await tx.get('users', id);
        if (before && !before.provisioning) return {id, ...before};
        const checked = await validate(tx, body);
        const after = {...checked, email, username, provisioning: false};
        tx.set('users', id, after);
        audit(tx, actor, id, null, after, 'CREAR_USUARIO');
        return {id, ...after};
      });
    },
    async update(actor, id, body) {
      can(actor, ['Administrador']);
      fail(id !== actor.uid, 'No puede modificar su propio acceso.');
      const data = await repo.transaction(tx => validate(tx, body));
      let account;
      try { account = await auth.getUser(id); }
      catch { fail(false, 'La cuenta no existe en Authentication.', 404); }
      const authPatch = {displayName: data.name, disabled: !data.active};
      if (typeof body.password === 'string' && body.password.trim()) {
        authPatch.password = toFirebasePassword(body.password);
      }
      // Firestore permissions are checked on every API call. Disable Auth before updating the profile.
      await auth.updateUser(id, authPatch);
      if (!data.active) await auth.revokeRefreshTokens(id);
      return repo.transaction(async tx => {
        const before = await tx.get('users', id);
        fail(before && !before.provisioning, 'El perfil no existe o su creación está pendiente.', 404);
        const checked = await validate(tx, body);
        const after = {...checked, email: account.email || '', username: before.username || data.name.toLowerCase(), provisioning: false};
        tx.set('users', id, after);
        audit(tx, actor, id, before, after, 'ACTUALIZAR_USUARIO');
        return {id, ...after};
      });
    },
    async remove(actor, id) {
      can(actor, ['Administrador']);
      fail(id !== actor.uid, 'No puede eliminar su propia cuenta.');
      try { await auth.deleteUser(id); }
      catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
      return repo.transaction(async tx => {
        const before = await tx.get('users', id);
        tx.remove('users', id);
        audit(tx, actor, id, before, null, 'ELIMINAR_USUARIO');
        return {id, deleted: true};
      });
    }
  };
}
module.exports = {createUsers};
