package org.knime.js.plotly.configcheck;

import java.util.HashSet;

import org.knime.core.data.DataTableSpec;
import org.knime.core.node.BufferedDataTable;
import org.knime.core.node.ExecutionContext;
import org.knime.core.node.defaultnodesettings.SettingsModel;
import org.knime.core.node.defaultnodesettings.SettingsModelBoolean;
import org.knime.core.node.defaultnodesettings.SettingsModelColumnFilter2;
import org.knime.core.node.defaultnodesettings.SettingsModelString;
import org.knime.core.node.port.PortObject;
import org.knime.core.node.util.filter.NameFilterConfiguration.FilterResult;
import org.knime.dynamic.js.v30.DynamicJSConfig;
import org.knime.dynamic.js.v30.DynamicStatefulJSProcessor;

public class ConfigCheck extends DynamicStatefulJSProcessor {

	/**
	 * {@inheritDoc}
	 */
	@Override
	public Object[] processInputObjects(PortObject[] inObjects, ExecutionContext exec, DynamicJSConfig config)
			throws Exception {
		BufferedDataTable table = (BufferedDataTable) inObjects[0];

		String[] potentialColumns = new String[] { "xAxisColumn", "yAxisColumn", "zAxisColumn", "axisColumn",
				"groupByColumn" };
		HashSet<String> colNames = new HashSet<String>();
		int colCount = 0;

		// Violin plot manually disable max rows option because it seems to be
		// inconsistent
		if (config.getModel("isViolin") != null
				&& ((SettingsModelBoolean) config.getModel("isViolin")).getBooleanValue()) {
			config.setMaxRows(Integer.MAX_VALUE);
		}

		for (String colName : potentialColumns) {

			if (config.getModel(colName) != null) {

				// Check category column settings
				String chosenColName = ((SettingsModelString) config.getModel(colName)).getStringValue();

//				if (chosenColName == null) { //note that 'rowId' and 'none' options currently default to null
//					throw new IllegalArgumentException("No column selected for category values.");
//				}
				if (chosenColName != null) {

					int columnIndex = table.getDataTableSpec().findColumnIndex(chosenColName);

					if (columnIndex < 0) {
						throw new IllegalArgumentException(
								"Index for category column with name " + chosenColName + " not found.");
					}
				}
				colCount++;
				colNames.add(chosenColName);
			}
		}

		if (colCount > 0 && colNames.size() < colCount) {
			setWarningMessage("One or more of the columns chosen are duplicated. This may affect the initial "
					+ "appearance of the view. If this was unintentional, please be sure to change the node settings"
					+ " either in the configuration dialog or in the view itself.");
		}

		if (config.getModel("columns") != null) {

			String[] selectedColumns = new String[0];
			final SettingsModel selectedColumnModel = config.getModel("columns");
			DataTableSpec inSpec = ((BufferedDataTable) inObjects[0]).getDataTableSpec();
			FilterResult filterResult = ((SettingsModelColumnFilter2) selectedColumnModel).applyTo(inSpec);
			selectedColumns = filterResult.getIncludes();

			if (selectedColumns.length < 1) {

				throw new IllegalArgumentException(
						"Frequency column filter include list empty. Select at least one frequency column.");
			}

		}

		Object[] outObjects = new Object[inObjects.length];
		outObjects[0] = inObjects[0];
		return outObjects;
	}
}
