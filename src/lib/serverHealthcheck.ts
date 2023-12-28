import esbuild from 'esbuild';
import vm from 'node:vm';
import net from 'node:net';
import { RhombusUtilities, type HealthcheckOutput } from './clientHealthcheck';

export async function runHealthcheck(typescript: string): Promise<HealthcheckOutput> {
	const ts = [RhombusUtilities, typescript, 'rhombusFinalExportResult = await health();'].join(
		'\n'
	);

	try {
		const build = await esbuild.transform(ts, {
			loader: 'ts',
			platform: 'node'
		});

		let logs = '';
		const context = vm.createContext({
			rhombusFinalExportResult: false,
			fetch,
			net,
			setTimeout,
			clearTimeout,
			console: {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				log: function (...args: any[]) {
					logs += args.join(' ') + '\n';
				},
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				error: function (...args: any[]) {
					logs += args.join(' ') + '\n';
				}
			}
		});
		const script = new vm.SourceTextModule(build.code, { context });
		await script.link((spec) => import(/* @vite-ignore */ spec));
		const evaluation = script.evaluate({ timeout: 10 * 1000, breakOnSigint: true });
		const timeout = new Promise<boolean>((resolve) => {
			setTimeout(() => resolve(true), 10 * 1000, 'two');
		});
		const timedOut = await Promise.race([timeout, evaluation]);
		if (timedOut) {
			return { status: 'error', message: 'Timed out' };
		}

		return {
			status: 'ran',
			logs,
			healthy: !!context.rhombusFinalExportResult
		};
	} catch (error) {
		const { message } = error as Error;
		return { status: 'error', message };
	}
}
