#!groovy
def BN = BRANCH_NAME == "master" || BRANCH_NAME.startsWith("releases/") ? BRANCH_NAME : "master"

library "knime-pipeline@$BN"

properties([
    pipelineTriggers([
        upstream('knime-js-base/' + env.BRANCH_NAME.replaceAll('/', '%2F'))
    ]),
    buildDiscarder(logRotator(numToKeepStr: '5')),
    disableConcurrentBuilds()
])


try {
    knimetools.defaultTychoBuild('org.knime.update.js.plotly')

    // workflowTests.runTests(
    //     dependencies: [
    //       repositories: ['knime-plotly', 'knime-js-base'],
    //         // an optional list of additional bundles/plug-ins from the repositories above that must be installed
    //         // ius: ['org.knime.json.tests']
    //     ],
    //     withAssertions: true,
    // )
    stage('Sonarqube analysis') {
        env.lastStage = env.STAGE_NAME
        // TODO: remove empty configuration once workflow tests are enabled.
        workflowTests.runSonar([])
    }
} catch (ex) {
    currentBuild.result = 'FAILURE'
    throw ex
} finally {
    notifications.notifyBuild(currentBuild.result);
}
/* vim: set shiftwidth=4 expandtab smarttab: */
