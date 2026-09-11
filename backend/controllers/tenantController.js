const tenantService = require('../services/tenantService');

class TenantController {
  async getGrupos(req, res) {
    try {
      const data = await tenantService.getGrupos();
      res.status(200).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async addGrupo(req, res) {
    try {
      const data = await tenantService.addGrupo(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async getEmpresas(req, res) {
    try {
      const data = await tenantService.getEmpresas();
      res.status(200).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async addEmpresa(req, res) {
    try {
      const data = await tenantService.addEmpresa(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async getSucursales(req, res) {
    try {
      const data = await tenantService.getSucursales();
      res.status(200).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async addSucursal(req, res) {
    try {
      const data = await tenantService.addSucursal(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async updateGrupo(req, res) {
    try {
      const data = await tenantService.updateGrupo(req.params.id, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async deleteGrupo(req, res) {
    try {
      const data = await tenantService.deleteGrupo(req.params.id);
      res.status(200).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async updateEmpresa(req, res) {
    try {
      const data = await tenantService.updateEmpresa(req.params.id, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async deleteEmpresa(req, res) {
    try {
      const data = await tenantService.deleteEmpresa(req.params.id);
      res.status(200).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async updateSucursal(req, res) {
    try {
      const data = await tenantService.updateSucursal(req.params.id, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async deleteSucursal(req, res) {
    try {
      const data = await tenantService.deleteSucursal(req.params.id);
      res.status(200).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }
}

module.exports = new TenantController();
