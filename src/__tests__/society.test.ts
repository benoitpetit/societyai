describe('Legacy API surface', () => {
	it('does not export legacy society() helpers', () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const core = require('..');

		expect(core.society).toBeUndefined();
		expect(core.societyCollaborative).toBeUndefined();
		expect(core.societyWithSynthesis).toBeUndefined();
		expect(core.runSociety).toBeUndefined();
		expect(core.runSocietyCollaborative).toBeUndefined();
		expect(core.runSocietyWithSynthesis).toBeUndefined();
	});
});
