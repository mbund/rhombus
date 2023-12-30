import * as echarts from 'echarts';

export type EChartsOptions = echarts.EChartsOption;
export type EChartsTheme = string | object;
export type EChartsRenderer = 'canvas' | 'svg';

export type ChartOptions = {
	theme?: EChartsTheme;
	renderer?: EChartsRenderer;
	options: EChartsOptions;
};

const DEFAULT_OPTIONS: Partial<ChartOptions> = {
	theme: undefined,
	renderer: 'svg'
};

export function chartable(element: HTMLElement, echartOptions: ChartOptions) {
	const { theme, renderer, options } = {
		...DEFAULT_OPTIONS,
		...echartOptions
	};
	const echartsInstance = echarts.init(element, theme, { renderer });
	echartsInstance.setOption(options);

	function handleResize() {
		echartsInstance.resize();
	}

	window.addEventListener('resize', handleResize);

	return {
		destroy() {
			echartsInstance.dispose();
			window.removeEventListener('resize', handleResize);
		},
		update(newOptions: ChartOptions) {
			echartsInstance.setOption({
				...echartOptions.options,
				...newOptions.options
			});
		}
	};
}
