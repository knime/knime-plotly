package org.knime.js.plotly.radarlimit;

import org.knime.core.node.ExecutionContext;
import org.knime.core.node.defaultnodesettings.SettingsModelIntegerBounded;
import org.knime.core.node.port.PortObject;
import org.knime.dynamic.js.v30.DynamicJSConfig;
import org.knime.js.plotly.configcheck.ConfigCheck;

public class RadarLimit extends ConfigCheck{

	/**
	 * {@inheritDoc}
	 */
	@Override
	public Object[] processInputObjects(PortObject[] inObjects, ExecutionContext exec, DynamicJSConfig config)
			throws Exception {
		
		if (config.getModel("maxRowsCust") != null) {
			
			int maxRows = ((SettingsModelIntegerBounded) config.getModel("maxRowsCust")).getIntValue();
			
			// Radar plot manually update maxRows
			config.setMaxRows(maxRows);
		}

		return super.processInputObjects(inObjects, exec, config);
	}

}
