const { createHash, randomUUID } = require('node:crypto');
const { can, fail } = require('./logistics');
const roles = ['Administrador', 'Logistica', 'Bodega', 'Tienda', 'Gerencia', 'Auditoria'];
function createUsers(repo, auth) {
  async function validate(tx, body) {
    fail(roles.includes(body.role), 'Rol inválido.');
    fail(typeof body.name === 'string' && body.name.trim(), 'Nombre obligatorio.');
    fail(Array.isArray(body.companyIds) && Array.isArray(body.branchIds), 'Asigne empresas y sucursales.');
    const data = {name: body.name.trim(), role: body.role, active: body.active !== false,
      companyIds: [...new Set(body.companyIds)], branchIds: [...new Set(body.branchIds)]};
    const companies = await tx.list('empresas'), branches = await tx.list('sucursales');
    fail(data.companyIds.every(id => companies.some(c => c.id === id && c.active !== false)), 'Empresa inválida o inactiva.');
    fail(data.branchIds.every(id => branches.some(b => b.id === id && b.active !== false && data.companyIds.includes(b.id_empresa))), 'La sucursal debe estar activa y pertenecer a una empresa autorizada.');
    fail(data.role === 'Administrador' || !data.active || (data.companyIds.length && data.branchIds.length), 'Asigne al menos una empresa y una sucursal al usuario.');
    return data;
  }
  const audit = (tx, actor, id, before, after, action) => tx.set('auditEvents', randomUUID(), {
    entityType: 'users', entityId: id, actorId: actor.uid, before, after, action, at: new Date().toISOString()
  });
  return {
    async create(actor, body, operationId) {
      can(actor, ['Administrador']);
      fail(typeof operationId === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(operationId), 'Identificador de operación inválido.');
      fail(typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()), 'Correo inválido.');
      fail(typeof body.password === 'string' && body.password.length >= 8 && body.password.length <= 128, 'La contraseña debe tener entre 8 y 128 caracteres.');
      const email = body.email.trim().toLowerCase();
      const id = 'lc_' + createHash('sha256').update(actor.uid + ':' + operationId).digest('hex').slice(0, 40);
      const data = await repo.transaction(tx => validate(tx, body));
      let account;
      try { account = await auth.createUser({uid: id, email, password: body.password, displayName: data.name, disabled: true}); }
      catch (e) {
        if (['auth/uid-already-exists','auth/email-already-exists'].includes(e.code)) {
          try { account = await auth.getUser(id); }
          catch { fail(false, 'Este correo ya tiene una cuenta. Edite su acceso existente.', 409); }
        }
        else { fail(false, e.code === 'auth/email-already-exists' ? 'Este correo ya tiene una cuenta. Edite su acceso existente.' : 'No se pudo crear la cuenta. Verifique el correo y la configuración de Authentication.'); }
      }
      fail(account.email?.toLowerCase() === email, 'La operación pertenece a otro correo.', 409);
      // Provision disabled first: failures never grant access. The same operation can be retried.
      const existing = await repo.transaction(async tx => {
        const before = await tx.get('users', id);
        if (before && !before.provisioning) return before;
        await validate(tx, body);
        tx.set('users', id, {...data, email, active: false, provisioning: true});
        return null;
      });
      if (existing) return {id, ...existing};
      await auth.updateUser(id, {disabled: !data.active, displayName: data.name});
      return repo.transaction(async tx => {
        const before = await tx.get('users', id);
        if (before && !before.provisioning) return {id, ...before};
        const checked = await validate(tx, body);
        const after = {...checked, email, provisioning: false};
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
      // Firestore permissions are checked on every API call. Disable Auth before updating the profile.
      await auth.updateUser(id, {displayName: data.name, disabled: !data.active});
      if (!data.active) await auth.revokeRefreshTokens(id);
      return repo.transaction(async tx => {
        const before = await tx.get('users', id);
        fail(before && !before.provisioning, 'El perfil no existe o su creación está pendiente.', 404);
        const checked = await validate(tx, body);
        const after = {...checked, email: account.email || '', provisioning: false};
        tx.set('users', id, after);
        audit(tx, actor, id, before, after, 'ACTUALIZAR_USUARIO');
        return {id, ...after};
      });
    }
  };
}
module.exports = {createUsers};
