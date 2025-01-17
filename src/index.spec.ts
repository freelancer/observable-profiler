/* eslint-env jest */
import { Observable, Subject, VirtualTimeScheduler, Subscriber } from 'rxjs';
import { delay, takeUntil, shareReplay } from 'rxjs/operators';

import { SubscriptionTracking } from './index';

describe('tracks subscriptions', () => {
    const tracking = new SubscriptionTracking();
    beforeAll(() => {
        tracking.setup(Observable);
    });

    beforeEach(() => {
        tracking.track();
        expect(tracking.getSubscribers().current().length).toBe(0);
    });

    afterEach(() => {
        const s = tracking.getSubscribers().current();
        tracking.track(false);
        expect(s.length).toBe(0);
    });

    describe('to cold observable', () => {
        it('unsubscribes imperatively', () => {
            const o = new Observable();
            const s = o.subscribe();
            expect(tracking.getSubscribers().current().length).toBe(1);
            s.unsubscribe();
        });

        it('unsubscribes on completion', () => {
            let subscriber: Subscriber<any>;
            const o = new Observable(s => { subscriber = s; });
            o.subscribe();
            expect(tracking.getSubscribers().current().length).toBe(1);
            subscriber!.complete();
        });

        it('unsubscribes with takeUntil', () => {
            const end = new Subject();
            const o = new Observable().pipe(takeUntil(end));
            o.subscribe();
            expect(tracking.getSubscribers().current().length).toBe(3);
            end.next();
        });
    });

    describe('to hot observable', () => {
        it('with delay', () => {
            const scheduler = new VirtualTimeScheduler();
            const end = new Subject();
            const o = new Subject().pipe(takeUntil(end), delay(2000, scheduler));
            o.subscribe();
            expect(tracking.getSubscribers().current().length).toBe(4);
            end.next();
            scheduler.flush();
        });

        it('with shareReplay', () => {
            const o = new Subject().pipe(shareReplay({ bufferSize: 1, refCount: true }));
            const s = o.subscribe();
            expect(tracking.getSubscribers().current().length).toBe(3);
            s.unsubscribe();
        });
    });
});
