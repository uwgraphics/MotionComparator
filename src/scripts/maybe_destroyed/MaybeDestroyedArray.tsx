import { Subscriber } from "../subscriptable/SubscribeArray";
import { MaybeDestroyed } from "./MaybeDestroyed";


/**
 * An array that holds `MaybeDestroyed` values.
 * 
 * It provides an interface that only provides access to objects that are
 * already destroyed.
 */
export class MaybeDestroyedArray<T> {
    protected _objs: [() => void, MaybeDestroyed<T>][];

    constructor(init:MaybeDestroyed<T>[]=[]) {
        this._objs = [];

        if (init) {
            for (const v of init) {
                this.push(v);
            }
        }
    }

    /**
     * Destroys and empties the contents of this array.
     */
    destroyContents() {
        for (const [,v] of this._objs) {
            v.destroy();
        }
        this.clean();
    }

    /**
     * Cleans the array so that all weak references to things that have been
     * deleted are romeved from the array.
     */
    clean() {
        let i = 0;
        while (i < this._objs.length) {
            let deref_value = this._objs[i][1].deref();
            if (deref_value === undefined) {
                this._objs.splice(i, 1);
                continue;
            }
            i += 1;
        }
    }

    /**
     * Returns `true` if the given value is contained by this array and false otherwise.
     */
    contains(value: T): boolean {
        for (const v of this) {
            if (v === value) { return true; }
        }
        return false;
    }

    /**
     * Pushes the Maybe destroyed object onto the array.
     */
    push(value: MaybeDestroyed<T>) {
        let weakValue = new WeakRef(value); // The callback should not hold onto the value.
        let unsubscribe = value.beforeDestroyed().subscribe(() => {
            let k = weakValue.deref()?.deref();
            if (k === undefined) { return false; }
            this.remove(k);
            return true;
        })
        this._objs.push([unsubscribe, value]);
    }

    /**
     * Removes the given value from the array (if it is contained by the array).
     * @returns `true` if the value was found and removed and `false` otherwise.
     */
    remove(value:T): boolean {
        for (let i = 0; i < this._objs.length; i++) {
            let [unsubscribe, v] = this._objs[i];
            let derefValue = v.deref();
            if (derefValue === undefined) {
                this._objs.splice(i, 1);
                i--;
                continue;
            }

            if (derefValue === value) {
                this._objs.splice(i, 1);
                unsubscribe();
                return true;
            }
        }
        return false;
    }

    /**
     * Returns the number of non-destroyed values in this array.
     */
    get length():number {
        let cnt = 0;
        for (const _ of this) { cnt += 1; }
        return cnt;
    }

    /**
     * @returns A generator that yields every alive value and its
     * `MaybeDestroyed` value holder.
     */
    aliveContents(): Generator<[T, MaybeDestroyed<T>], void, void> {
        let t = this;
        function * inner():Generator<[T, MaybeDestroyed<T>], void, void> {
            for (let i = 0; i < t._objs.length; i++) {
                let [unsubscribe, m] = t._objs[i];
                let value:T | undefined = m.deref();
                if (value !== undefined) {
                    yield [value, m];
                } else {
                    t._objs.splice(i, 1);
                    unsubscribe();
                    i--;
                }
            }
        }
        return inner();
    }

    /**
     * @returns An iterator over every non-destroyed value in the array.
     */
    [Symbol.iterator]():Generator<T, void, void> {
        let t = this;
        function * inner():Generator<T, void, void> {
            for (let i = 0; i < t._objs.length; i++) {
                let [unsubscribe, m] = t._objs[i];
                let value:T | undefined = m.deref();
                if (value !== undefined) {
                    yield value;
                    i += 1;       
                } else {
                    t._objs.splice(i, 1);
                    unsubscribe();
                    i--;
                }
            }
        }
        return inner();
    }
}