package org.knime.js.plotly.violin;

import org.knime.core.node.ExecutionContext;
import org.knime.core.node.port.PortObject;
import org.knime.dynamic.js.v30.DynamicJSConfig;
import org.knime.js.plotly.configcheck.ConfigCheck;

public class ViolinPre extends ConfigCheck {

	/**
	 * {@inheritDoc}
	 */
	@Override
	public Object[] processInputObjects(PortObject[] inObjects, ExecutionContext exec, DynamicJSConfig config)
			throws Exception {
		
		// Violin plot manually disable max rows option
		config.setMaxRows(Integer.MAX_VALUE);

		return super.processInputObjects(inObjects, exec, config);
	}

}
