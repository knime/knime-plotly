package org.knime.js.plotly.configcheck;

import java.util.HashSet;

import org.knime.core.data.DataTableSpec;
import org.knime.core.node.BufferedDataTable;
import org.knime.core.node.ExecutionContext;
import org.knime.core.node.defaultnodesettings.SettingsModel;
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

		for (String colName : potentialColumns) {

			if (config.getModel(colName) != null) {

				// Check category column settings
				String chosenColName = ((SettingsModelString) config.getModel(colName)).getStringValue();

//				if (chosenColName == null) { //note that 'rowId' and 'none' options currently default to null
//					throw new IllegalArgumentException("No column selected for category values.");
//				}
				if (chosenColName != null) {

					int columnIndex = table.getDataTableSpec().findColumnIndex(chosenColName);

					if (columnIndex < 0 && !chosenColName.equals("none")) {
						throw new IllegalArgumentException(
								"Index for category column with name " + chosenColName + " not found.");
					}
					colCount++;
					colNames.add(chosenColName);
				}
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
				throw new IllegalArgumentException("Included column list empty. Select at least one column.");
			}

		}

		long tableSize = table.size();
		int maxRows = config.getMaxRows();
		String glWarning = "";
		
		if (config.getModel("enableGL") != null) {
			glWarning = "If available, enabling \"Use WebGL graphic library\" may help.";
		}
		
		if (tableSize >= 100000 && maxRows >= 250000) {
			setWarningMessage("The number of rows you are trying to visualize may cause performance issues\n"
					+ "in some circumstances. If the view does not load please try again or reduce the size\n"
					+ "of your data. " + glWarning);
		}

		Object[] outObjects = new Object[inObjects.length];
		outObjects[0] = inObjects[0];
		return outObjects;
	}
}
