import { MaybeDestroyed } from "../maybe_destroyed/MaybeDestroyed";


export class WeakRefMaybeDestroyedArray<T> {
    protected _refs: WeakRef<MaybeDestroyed<T>>[]

    constructor(init:MaybeDestroyed<T>[]=[]) {
        this._refs = [];

        if (init) {
            for (const v of init) {
                this.push(v);
            }
        }
    }

    /**
     * Cleans the array so that all weak references to things that have been
     * deleted are romeved from the array.
     */
    clean() {
        let i = 0;
        while (i < this._refs.length) {
            let deref_value = this._refs[i].deref();
            if (deref_value === undefined || deref_value.deref() === undefined) {
                this._refs.splice(i, 1);
                continue;
            }
            i += 1;
        }
    }

    push(value:MaybeDestroyed<T>) {
        this._refs.push(new WeakRef(value));
    }

    remove(value:T) {
        let i = 0;
        while (i < this._refs.length) {
            let derefValue = this._refs[i].deref();
            if (derefValue === undefined) {
                this._refs.splice(i, 1);
                continue;
            }

            let destroyValue = derefValue.deref();
            if (destroyValue === undefined) {
                this._refs.splice(i, 1);
                continue;
            } else if (destroyValue === value) {
                this._refs.splice(i, 1);
                break;
            }
            i += 1;
        }
    }

    get length():number {
        return Array.from(this).length;
    }

    * reverse():Generator<T, void, void> {
        let cache = Array.from(this);
        for (const v of cache.reverse()) {
            yield v;
        }
    }

    /**
     * Destroys and empties the contents of this array.
     */
    destroyContents() {
        for (const v of this._refs) {
            let ref = v.deref();
            if (ref !== undefined) {
                ref.destroy();
            }
        }
        this.clean();
    }

    [Symbol.iterator]():Generator<T, void, void> {
        let t = this;
        function * inner():Generator<T, void, void> {
            let i = 0;
            while (i < t._refs.length) {
                let value:MaybeDestroyed<T> | undefined = t._refs[i].deref();
                if (value !== undefined) {
                    let v = value.deref();
                    if (v !== undefined) {
                        yield v;
                        i += 1;       
                    } else {
                        t._refs.splice(i, 1);
                    }
                } else {
                    t._refs.splice(i, 1);
                }
            }
        }
        return inner();
    }
}