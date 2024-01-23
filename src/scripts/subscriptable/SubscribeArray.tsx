export type Subscriber = () => boolean | undefined;

/**
 * An array of subscribers.
 * 
 * This class allows an object to have an action that
 * multiple other objects subscribe to be notified of. Whenever the action is
 * done, the object calls this array to notify all other objects that
 * the action was either done or is about to be done (can use a different
 * SubscribeArray for before and after). Each subscriber function
 * returns `true` or `undefined` if it still wants to be subscribed
 * and `false` if it is done being subscribed.
 */
export class SubscribeArray {
    protected _subscribers: Subscriber[];

    constructor(...startingSubscribers: Subscriber[]) {
        this._subscribers = startingSubscribers;
    }

    /**
     * Adds the given subscriber to the SubscribeArray.
     * 
     * @param subscriber The subscriber to add to the array.
     * @returns The function to call when you want to unsubscribe.
     */
    subscribe(subscriber: Subscriber): () => void {
        this._subscribers.push(subscriber);

        return () => {
            let i = this._subscribers.indexOf(subscriber);
            if (i > 0) { this._subscribers.splice(i, 1); }
        }
    }

    /**
     * Call every subscribed function in this array with the given
     * argument.
     * 
     * @param arg The argument to pass each subscribed function.
     */
    call() {
        for (let i = 0; i < this._subscribers.length; i++) {
            let sub = this._subscribers[i];
            if (sub() === false) {
                this._subscribers.splice(i, 1);
                i--;
            }
        }
    }
}


