const configService = require('../services/configService');

exports.getConfig = async (req, res) => {
  try {
    const config = await configService.getConfig();
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveConfig = async (req, res) => {
  try {
    const configData = req.body;
    const newConfig = await configService.saveConfig(configData);
    res.status(200).json({ success: true, data: newConfig });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
