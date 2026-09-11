const pedidoService = require('../services/pedidoService');

class PedidoController {
  async crearPedido(req, res) {
    try {
      const pedidoData = req.body;
      const nuevoPedido = await pedidoService.crearPedido(pedidoData);
      
      res.status(201).json({
        success: true,
        message: 'Pedido creado exitosamente (PENDIENTE).',
        data: nuevoPedido
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async obtenerPedidos(req, res) {
    try {
      const pedidos = await pedidoService.obtenerPedidos();
      res.status(200).json({ success: true, data: pedidos });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async actualizarPedido(req, res) {
    try {
      const { id } = req.params;
      const actualizacion = req.body;
      
      // NOTA: En un sistema real, 'usuarioRol' vendría del token JWT (req.user.rol)
      // Para efectos de esta prueba, asumimos que viene en el header o body temporalmente.
      const usuarioRol = req.headers['x-usuario-rol'] || 'Tienda'; 

      const pedidoActualizado = await pedidoService.actualizarPedido(id, actualizacion, usuarioRol);
      res.status(200).json({
        success: true,
        message: 'Pedido actualizado.',
        data: pedidoActualizado
      });
    } catch (error) {
      // Diferenciar error de negocio vs servidor (simplificado como 400 por ahora)
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async eliminarPedido(req, res) {
    try {
      const { id } = req.params;
      await pedidoService.eliminarPedido(id);
      res.status(200).json({ success: true, message: 'Pedido eliminado.' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new PedidoController();
