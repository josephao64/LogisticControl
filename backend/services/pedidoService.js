const { db } = require('../config/firebase');

const PEDIDOS_COLLECTION = 'pedidos';

class PedidoService {
  async getNextSequence() {
    const counterRef = db.collection('counters').doc('pedidos');
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);
      let nextSeq = 1;
      if (doc.exists) {
        nextSeq = doc.data().seq + 1;
      }
      transaction.set(counterRef, { seq: nextSeq }, { merge: true });
      return nextSeq;
    });
  }

  async crearPedido(pedidoData) {
    if (pedidoData.estado && pedidoData.estado !== 'PENDIENTE') {
      throw new Error('Un nuevo pedido solo puede ser creado con el estado PENDIENTE.');
    }

    // 1. Fetch products and providers
    const productosSnapshot = await db.collection('productos').get();
    const productosMap = {};
    productosSnapshot.forEach(doc => { productosMap[doc.data().sku] = doc.data(); });

    const proveedoresSnapshot = await db.collection('proveedores').get();
    const proveedoresMap = {};
    proveedoresSnapshot.forEach(doc => { proveedoresMap[doc.id] = doc.data(); });

    // 2. Group items by proveedor (or just use the one passed from frontend)
    // Actually the frontend now sends the items for a single provider!
    // Let's adapt if frontend sends multiple or single.
    const grupos = {};
    pedidoData.items.forEach(item => {
      // Use the item provider if available, else lookup, else the one passed in pedidoData
      const prodInfo = productosMap[item.sku];
      let provId = item.id_proveedor || item.proveedor_id || 
                   (prodInfo ? (prodInfo.id_proveedor || prodInfo.proveedor_id) : null) || 
                   pedidoData.id_proveedor || pedidoData.proveedor_id || 'PROV_DESCONOCIDO';
      
      const cantidadSolicitada = Number(item.cantidad_solicitada) || 0;
      
      // ONLY INCLUDE ITEMS THAT ARE ACTUALLY REQUESTED
      if (cantidadSolicitada > 0) {
        if (!grupos[provId]) {
          grupos[provId] = {
            proveedor_id: provId,
            proveedor_nombre: proveedoresMap[provId] ? proveedoresMap[provId].nombre : 'Desconocido',
            nodo_despacho: proveedoresMap[provId] ? (proveedoresMap[provId].nodos_sucursal && proveedoresMap[provId].nodos_sucursal[pedidoData.id_sucursal || pedidoData.tienda_id] ? proveedoresMap[provId].nodos_sucursal[pedidoData.id_sucursal || pedidoData.tienda_id] : proveedoresMap[provId].nodo_entrega) : (pedidoData.nodo_entrega || 'BODEGA'),
            items: [],
            total_calculado: 0
          };
        }
        
        const precioUnitario = prodInfo ? prodInfo.precio_unitario : 0;
        const subtotal = cantidadSolicitada * (precioUnitario || 0);
        grupos[provId].total_calculado += subtotal;

        grupos[provId].items.push({
          ...item,
          precio_unitario: precioUnitario || 0,
          subtotal: subtotal
        });
      }
    });

    try {
      const grupoAuditoriaId = `AUD-${Date.now()}`;
      const pedidosCreados = [];

      for (const provId in grupos) {
        const grupo = grupos[provId];
        const seq = await this.getNextSequence();
        const displayId = `PED-${String(seq).padStart(3, '0')}`;

        const subPedido = {
          id_sucursal: pedidoData.id_sucursal || pedidoData.tienda_id,
          id_empresa: pedidoData.id_empresa,
          id_grupo: pedidoData.id_grupo,
          tienda_id: pedidoData.tienda_id || pedidoData.id_sucursal, // compat
          grupo_auditoria: grupoAuditoriaId,
          proveedor_id: grupo.proveedor_id,
          proveedor_nombre: grupo.proveedor_nombre,
          nodo_entrega: grupo.nodo_despacho,
          nodo_despacho: grupo.nodo_despacho, // compat
          is_emergency: pedidoData.is_emergency || false,
          is_rectified: false,
          estado: 'PENDIENTE',
          fecha: new Date().toISOString(),
          items: grupo.items,
          total_calculado: grupo.total_calculado,
          numero_factura: pedidoData.numero_factura || null,
          url_evidencia: pedidoData.url_evidencia || null
        };

        const docRef = db.collection(PEDIDOS_COLLECTION).doc(displayId);
        await docRef.set(subPedido);
        pedidosCreados.push({ id: displayId, ...subPedido });
      }

      return pedidosCreados;
    } catch (error) {
      throw new Error(`Error al crear los sub-pedidos: ${error.message}`);
    }
  }

  async actualizarPedido(id, actualizacion, usuarioRol) {
    const pedidoRef = db.collection(PEDIDOS_COLLECTION).doc(id);
    const doc = await pedidoRef.get();

    if (!doc.exists) {
      throw new Error('Pedido no encontrado.');
    }

    const pedidoActual = doc.data();

    // Regla de Negocio: Solo Logistica puede pasarlo a TOMADO_POR_PROVEEDOR o modificar cantidades.
    if (actualizacion.estado === 'TOMADO_POR_PROVEEDOR' && usuarioRol !== 'Logistica') {
      throw new Error('Solo el personal de Logística puede aprobar un pedido al proveedor.');
    }

    // Regla de Negocio: Validación de Nodo de Despacho
    if (actualizacion.estado === 'ENTREGA_EN_BODEGA' && pedidoActual.nodo_despacho !== 'Bodega') {
      throw new Error('No se puede recibir en Bodega un pedido de Entrega Directa.');
    }

    // Prevención de Duplicidad: Validar que el numero_factura no exista en un documento finalizado
    if (actualizacion.numero_factura) {
      const isDuplicate = await this.verificarFacturaDuplicada(actualizacion.numero_factura, id);
      if (isDuplicate) {
        throw new Error(`La factura ${actualizacion.numero_factura} ya está registrada en un pedido finalizado.`);
      }
    }

    try {
      // Actualizamos solo los campos enviados
      await pedidoRef.update({
        ...actualizacion,
        ultima_actualizacion: new Date().toISOString()
      });
      
      const docActualizado = await pedidoRef.get();
      const pedidoCompletado = { id, ...docActualizado.data() };

      return pedidoCompletado;
    } catch (error) {
      throw new Error(`Error al actualizar el pedido: ${error.message}`);
    }
  }

  async verificarFacturaDuplicada(numero_factura, excludeId = null) {
    const snapshot = await db.collection(PEDIDOS_COLLECTION)
      .where('numero_factura', '==', numero_factura)
      .where('estado', '==', 'RECIBIDO_FINALIZADO')
      .get();

    if (snapshot.empty) return false;

    // Si encontramos facturas, verificamos que no sea el mismo pedido que estamos editando
    let esDuplicada = false;
    snapshot.forEach(doc => {
      if (doc.id !== excludeId) {
        esDuplicada = true;
      }
    });

    return esDuplicada;
  }

  async eliminarPedido(id) {
    try {
      const pedidoRef = db.collection(PEDIDOS_COLLECTION).doc(id);
      await pedidoRef.delete();
      return true;
    } catch (error) {
      throw new Error(`Error al eliminar pedido: ${error.message}`);
    }
  }

  async obtenerPedidos() {
    try {
      const snapshot = await db.collection(PEDIDOS_COLLECTION).orderBy('fecha', 'desc').get();
      const pedidos = [];
      snapshot.forEach(doc => {
        pedidos.push({ id: doc.id, ...doc.data() });
      });
      return pedidos;
    } catch (error) {
      throw new Error(`Error al obtener pedidos: ${error.message}`);
    }
  }
}

module.exports = new PedidoService();
