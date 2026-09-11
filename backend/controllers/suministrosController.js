const suministrosService = require('../services/suministrosService');

class SuministrosController {
  async getProveedores(req, res) {
    try {
      const proveedores = await suministrosService.getProveedores();
      res.status(200).json({ success: true, data: proveedores });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getInsumos(req, res) {
    try {
      const insumos = await suministrosService.getInsumos();
      res.status(200).json({ success: true, data: insumos });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async addProveedor(req, res) {
    try {
      const result = await suministrosService.addProveedor(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async addInsumo(req, res) {
    try {
      const result = await suministrosService.addInsumo(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async updateProveedor(req, res) {
    try {
      const result = await suministrosService.updateProveedor(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async deleteProveedor(req, res) {
    try {
      const result = await suministrosService.deleteProveedor(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async updateInsumo(req, res) {
    try {
      const result = await suministrosService.updateInsumo(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async deleteInsumo(req, res) {
    try {
      const result = await suministrosService.deleteInsumo(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }
}

module.exports = new SuministrosController();
