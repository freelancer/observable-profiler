/**
 * Represents the source of an subscription
 */
export class SubscriptionSource extends Error {
    /**
     * @param subscription A subscription to an Observable
     * @param id The id of the subscription chain
     */
    constructor(readonly subscription: object, readonly id: number) {
        super();
    }
}

/**
 * Accessor to the current subscription list.
 */
export class Iterator {
    constructor(private readonly subscribers: Set<SubscriptionSource>) {
    }

    /**
     * Returns a snapshot of current subscriptions
     */
    current() {
        return [...this.subscribers];
    }
}

export class SubscriptionTracking {
    private subscribers: Set<SubscriptionSource> | undefined;
    private isTracking = false;

    /**
     * Call setup() once before any calls to track()
     * @param Observable Bring your own Observable class to track
     */
    setup<T>(Observable: any) {
        const origSubscribe = Observable.prototype.subscribe;
        Observable.prototype.subscribe = subscribe;

        let id = 0;
        let root = false;
        const that = this;

        function subscribe(this: any, ...args: any[]) {
            let setRoot = false;
            if (!root) {
                setRoot = true;
                root = true;
                id++;
            }
            const subscription = origSubscribe.apply(this, args);
            if (that.isTracking) {
                const currentSubscribers = that.subscribers;
                const sub = new SubscriptionSource(subscription, id);
                if (currentSubscribers) {
                    currentSubscribers.add(sub);
                }
                subscription.add(() => {
                    if (currentSubscribers) {
                        currentSubscribers.delete(sub);
                    }
                });
            }
            if (setRoot) {
                root = false;
            }
            return subscription;
        };
    }

    /**
     * Returns a snapshot of current subscriptions since tracking started
     */
    getSubscribers() {
        return new Iterator(this.subscribers ? this.subscribers : new Set());
    }

    /**
     * Starts/stops tracking of Observable subscriptions
     * @param {boolean} track `true` to start; `false` to stop
     */
    track(track = true) {
        if (this.isTracking === track) {
            return;
        }
        this.isTracking = track;
        if (track) {
            this.subscribers = new Set();
        }
        return this.getSubscribers();
    }

    delay(ms: number) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }

    /**
     * Outputs to console the list of active subscriptions
     * @param {string} prefix Prints a prefix on each tracked subscription
     * @param {number} timeout Give some leeway (in ms) for time-based subscriptions to finish
     * @param {boolean} rewriteStack `true` to remove some noise from stack traces
     * @param {RegExp} filterStackRe a custom Regexp object to filter stack frames
     * @param {boolean} reportInnerSubscriptions `true` to report indirect subscriptions
     * @param {Iterator} subscribers The result of a previous call to `track(false)`
     */
    async printSubscribers({
        prefix = '',
        timeout = 0,
        rewriteStack = false,
        filterStackRe = undefined,
        reportInnerSubscriptions = false,
        subscribers = undefined,
    }: {
        prefix?: string,
        timeout?: number,
        rewriteStack?: boolean,
        filterStackRe?: RegExp,
        reportInnerSubscriptions?: boolean,
        subscribers?: Iterator,
    }) {
        const sub = subscribers || this.getSubscribers();

        await this.delay(timeout);

        const current = sub.current();
        if (!current.length) {
            return;
        }

        console.error(prefix, 'Current subscriptions (including indirect/nested):', current.length);
        const map = new Set();
        for (const val of current) {
            if (!reportInnerSubscriptions && map.has(val.id)) {
                continue;
            }
            if (rewriteStack || filterStackRe) {
                const frames = val.stack!.split('\n');
                val.stack = (filterStackRe && frames.filter((it: string) => !it.includes('Observable.subscribe') && filterStackRe!.test(it)).join('\n')) || frames.join('\n');
            }
            console.error(prefix, `#${val.id}:`, val);
            map.add(val.id);
        }
    }
}
