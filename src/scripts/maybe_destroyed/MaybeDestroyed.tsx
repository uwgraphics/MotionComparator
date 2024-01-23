import { SubscribeArray } from "../subscriptable/SubscribeArray";
import { SubscribeArrayWithArg } from "../subscriptable/SubscribeArrayWithArg";

/**
 * Sometimes, it is necessary to make it such that multiple different sources
 * are able to explicitly destroy the same object. When this is the case, wrap
 * that object in `MaybeDestroyed` and pass around references to the
 * `MaybeDestroyed` object instead. Any object that owns the `MaybeDestroyed`
 * object can then destroy the object when necessary.
 * 
 * Note: Since javascript has no way to explicitly destroy an object, to
 * "destroy" an object simply means to forget its reference. As such, if
 * you give it a reference owned by other objects already then a "leak"
 * will occur where even after "destruction" the object will live on since other
 * objects are referring to it. To prevent this, either give them all references
 * to this MaybeDestroyed object or give them WeakRefs to the inner value.
 */
export class MaybeDestroyed<T> {
    protected _beforeDestroyed: SubscribeArrayWithArg<T>;
    protected _value?: T;
    protected _afterDestroyed: SubscribeArrayWithArg<T>;

    /**
     * @param object The object that this object may destroy when instructed to.
     */
    constructor(object: T) {
        this._value = object;
        this._beforeDestroyed = new SubscribeArrayWithArg();
        this._afterDestroyed = new SubscribeArrayWithArg();
    }

    /**
     * @returns The subscriber array that will be called right before this
     * object is destroyed. The passed in arg is the value that is about to be
     * "destroyed".
     */
    beforeDestroyed(): SubscribeArrayWithArg<T> {
        return this._beforeDestroyed
    }

    /**
     * @returns The subscriber array that will be called right after this
     * object is destroyed. The passed in arg is the value that was just
     * "destroyed".
     */
    afterDestroyed(): SubscribeArrayWithArg<T> {
        return this._afterDestroyed
    }

    /**
     * @returns `true` if the contained object is still alive and false
     * otherwise.
     */
    isAlive(): boolean {
        return !this.isDestroyed();
    }

    /**
     * @returns `true` if the inner object is still alive and false
     * otherwise.
     */
    isDestroyed(): boolean {
        return this._value === undefined;
    }

    /**
     * @returns The contained object if it is still alive and undefined otherwise.
     */
    deref(): T | undefined {
        return this._value;
    }

    /**
     * @param onAlive The callback to call if alive.
     * @param onDead The callback to call if dead.
     * @returns Whatever the called callback returns.
     */
    ifElseAlive<O>(onAlive: (_:T) => O, onDead: () => O): O {
        let o = this._value;
        if (o !== undefined) {
            return onAlive(o);
        } else {
            return onDead();
        }
    }

    /**
     * @param callback The callback to call if the object is still alive.
     */
    ifAlive(callback: (_:T) => void) {
        let o = this._value;
        if (o) { callback(o); }
    }

    /**
     * Destroys the object that this `MaybeDestoyed` object contains.
     */
    destroy() {
        let value = this._value;
        if (value !== undefined) {
            this._beforeDestroyed.call(value);
            this._value = undefined;
            this._afterDestroyed.call(value);
        }
    }
}