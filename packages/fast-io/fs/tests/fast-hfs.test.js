/**
 * @fileoverview Tests for the Hfs class.
 * @author MediaFire
 */

/* global navigator */

//------------------------------------------------------------------------------
// Imports
//------------------------------------------------------------------------------

import { FastHfsImpl } from "../src/fast-hfs.js";
import { HfsImplTester } from "@humanfs/test";
import assert from "node:assert";

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const fixturesDir = "fixtures";
const root = await navigator.storage.getDirectory();

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

const tester = new HfsImplTester({
	outputDir: fixturesDir,
	assert,
	test: globalThis,
	expectedEntries: [fixturesDir],
});

await tester.test({
	name: "MemoryHfsImpl",
	impl: new FastHfsImpl({ root }),
});
