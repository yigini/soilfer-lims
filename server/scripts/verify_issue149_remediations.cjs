'use strict';
// #179 pin 5990137651: all fixture access lives in the closed test subprocess.
require('./run_test_rehearsal.cjs').runTestRehearsal('verify_issue149_remediations.cjs');
