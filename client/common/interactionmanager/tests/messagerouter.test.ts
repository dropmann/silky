import { afterEach, describe, expect, it, vi } from 'vitest';

import { FocusLoopMessageRouter } from '../messagerouter';
import type { WindowBridge } from '../windowbridge';

function createRouter(isolated: unknown[] = []) {
    let listener: ((event: MessageEvent) => void) | null = null;
    vi.stubGlobal('window', {
        addEventListener: (type: string, handler: (event: MessageEvent) => void) => {
            if (type === 'message')
                listener = handler;
        },
    });

    const bridge = {
        isMainWindow: true,
        isIsolatedSource: (source: unknown) => isolated.includes(source),
    } as unknown as WindowBridge;

    const router = new FocusLoopMessageRouter(bridge);
    router.installMessageListener();

    const dispatch = (source: unknown, data: unknown) => listener?.({ source, data } as MessageEvent);
    return { router, dispatch };
}

describe('FocusLoopMessageRouter', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('handles focus loop messages from other windows', () => {
        const { router, dispatch } = createRouter();
        const handler = vi.fn();
        router.register('processKeyObj', handler);

        dispatch({}, { type: 'focusLoop', id: 'processKeyObj', args: [ 'a' ] });

        expect(handler).toHaveBeenCalledWith('a');
    });

    it('ignores messages from isolated frames', () => {
        const isolatedWindow = {};
        const { router, dispatch } = createRouter([ isolatedWindow ]);
        const handler = vi.fn();
        router.register('processKeyObj', handler);

        dispatch(isolatedWindow, { type: 'focusLoop', id: 'processKeyObj', args: [ 'a' ] });

        expect(handler).not.toHaveBeenCalled();
    });

    it('ignores messages without data', () => {
        const { router, dispatch } = createRouter();
        const handler = vi.fn();
        router.register('processKeyObj', handler);

        expect(() => dispatch({}, null)).not.toThrow();
        expect(handler).not.toHaveBeenCalled();
    });
});
