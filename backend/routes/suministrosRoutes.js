const express = require('express');
const router = express.Router();
const suministrosController = require('../controllers/suministrosController');

router.get('/proveedores', suministrosController.getProveedores);
router.post('/proveedores', suministrosController.addProveedor);
router.put('/proveedores/:id', suministrosController.updateProveedor);
router.delete('/proveedores/:id', suministrosController.deleteProveedor);

router.get('/insumos', suministrosController.getInsumos);
router.post('/insumos', suministrosController.addInsumo);
router.put('/insumos/:id', suministrosController.updateInsumo);
router.delete('/insumos/:id', suministrosController.deleteInsumo);

module.exports = router;
