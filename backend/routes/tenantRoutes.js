const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');

router.get('/grupos', tenantController.getGrupos);
router.post('/grupos', tenantController.addGrupo);
router.put('/grupos/:id', tenantController.updateGrupo);
router.delete('/grupos/:id', tenantController.deleteGrupo);

router.get('/empresas', tenantController.getEmpresas);
router.post('/empresas', tenantController.addEmpresa);
router.put('/empresas/:id', tenantController.updateEmpresa);
router.delete('/empresas/:id', tenantController.deleteEmpresa);

router.get('/sucursales', tenantController.getSucursales);
router.post('/sucursales', tenantController.addSucursal);
router.put('/sucursales/:id', tenantController.updateSucursal);
router.delete('/sucursales/:id', tenantController.deleteSucursal);

module.exports = router;
