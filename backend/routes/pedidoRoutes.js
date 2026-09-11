const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');

// Rutas para Pedidos
router.post('/', pedidoController.crearPedido);
router.get('/', pedidoController.obtenerPedidos);
router.put('/:id', pedidoController.actualizarPedido);
router.delete('/:id', pedidoController.eliminarPedido);

module.exports = router;
