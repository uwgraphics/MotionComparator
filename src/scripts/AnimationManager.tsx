import { AnimationGroup, serialized_animation_group } from "./AnimationGroup";
import { AnimationTable } from './AnimationTable';
import { APP } from "./constants";
import { Robot } from "./objects3D/Robot";

export interface serialized_animation_manager {
    activeAnimations: serialized_animation_group[],
    storedAnimations: serialized_animation_group[],
    lastTime: number,
}


/**
 * Manages Animations and whether they are currently playing or not.
 */
export class AnimationManager {
    protected _activeAnimations: AnimationGroup[]; // AnimationGroups that are running
    protected _storedAnimations: AnimationGroup[]; // AnimationGroups that are stored but are not currently running
    protected _lastTime: number; // the total time of the animation as it was the last time it updated

    constructor() {
        this._activeAnimations = [];
        this._storedAnimations = [];
        this._lastTime = 0;
    }

    addToAnimationManager(otherAnimationManager:AnimationManager) {
        for (const anim of this._activeAnimations) {
            otherAnimationManager.addActiveAnimation(anim);
        }
        for (const anim of this._storedAnimations) {
            otherAnimationManager.addStoredAnimation(anim);
        }
    }

    removeFromAnimationManager(otherAnimationManager:AnimationManager) {
        for (const anim of this._activeAnimations) {
            otherAnimationManager.removeActiveAnimation(anim);
        }
        for (const anim of this._storedAnimations) {
            otherAnimationManager.removeStoredAnimation(anim);
        }
    }

    storeAllGroups() {
        this._storedAnimations = [...this._storedAnimations, ...this._activeAnimations]
        this._activeAnimations = [];
        APP.updateUI();
    }

    activateAllgroups() {
        this._activeAnimations = [...this._storedAnimations, ...this._activeAnimations]
        this._storedAnimations = [];
        APP.updateUI();
    }

    clear() {
        this._activeAnimations = [];
        this._storedAnimations = [];
    }

    animationGroups():AnimationGroup[] {
        let ags:AnimationGroup[] = [];
        for (const a of this._activeAnimations) {
            ags.push(a);
        }

        for (const a of this._storedAnimations) {
            ags.push(a);
        }
        return ags;
    }

    /**
     * Removes the given animation group from the AnimationManager without
     * caring whether it is active or stored.
     * @param animGroup The animation group to remove.
     */
    removeAnimationGroup(animGroup:AnimationGroup) {
        this.removeActiveAnimation(animGroup);
        this.removeStoredAnimation(animGroup);
    }

    /**
     * Returns the current time of this AnimationManager
     * i.e. the last time it rendered.
     */
    time():number {
        return this._lastTime;
    }

    setTime(newTime:number) {
        this._lastTime = newTime;
        this.updateAnimations();
    } 

    activeAnimations():ReadonlyArray<AnimationGroup> {
        return this._activeAnimations;
    }

    addActiveAnimation(animationGroup:AnimationGroup) {
        this.removeActiveAnimation(animationGroup); // Remove from active if active
        this.removeStoredAnimation(animationGroup); // Remove from storage if stored
        this._activeAnimations.push(animationGroup); // add to active
        APP.updateUI();
    }

    removeActiveAnimation(animationGroup:AnimationGroup) {
        let i = this._activeAnimations.indexOf(animationGroup);
        if (i > -1) {
            this._activeAnimations.splice(i, 1); 
            APP.updateUI();
        }
    }

    storedAnimations():ReadonlyArray<AnimationGroup> {
        return this._storedAnimations;
    }

    addStoredAnimation(animationGroup:AnimationGroup) {
        this.removeStoredAnimation(animationGroup); // Remove from storage if stored
        this.removeActiveAnimation(animationGroup); // Remove from active if active
        this._storedAnimations.push(animationGroup);
        APP.updateUI();
    }

    removeStoredAnimation(animationGroup:AnimationGroup) {
        let i = this._storedAnimations.indexOf(animationGroup);
        if (i > -1) {
            this._storedAnimations.splice(i, 1); 
            APP.updateUI();
        }
    }

    startTime():number {
        let minEndTime = Infinity;
        for (const anim of this._activeAnimations) {
            minEndTime = Math.min(minEndTime, anim.startTime());
        }
        if (minEndTime === Infinity) minEndTime = 0;
        return minEndTime;
    }

    endTime():number {
        let maxEndTime = -Infinity;
        for (const anim of this._activeAnimations) {
            maxEndTime = Math.max(maxEndTime, anim.endTime());
        }
        if (maxEndTime === -Infinity) maxEndTime = 1;
        return maxEndTime;
    }

    protected updateAnimations() {
        let endTime = this.endTime();
        if (this._lastTime > endTime) {
            this._lastTime = endTime;
        }

        let startTime = this.startTime();
        if (this._lastTime < startTime) {
            this._lastTime = startTime;
        }

        for (const anim of this._activeAnimations) {
            anim.update(this._lastTime);
        }

        APP.updateUI();
        APP.render();
    }

    /**
     * Copies the given AnimationManager into this one.
     * @param robots The robot map to map the Robots of the animations of this
     * AnimationManager to their copies.
     */
    copy(animMan: AnimationManager, robots: Map<Robot, Robot>): AnimationManager {
        let cloned: Map<AnimationGroup, AnimationGroup> = new Map();
        for (const anim of animMan._activeAnimations) {
            let clone = cloned.get(anim);
            if (clone) {
                this.addActiveAnimation(clone);
            } else {
                clone = anim.clone(robots);
                cloned.set(anim, clone);
                this.addActiveAnimation(clone);
            }
        }

        for (const anim of animMan._storedAnimations) {
            let clone = cloned.get(anim);
            if (clone) {
                this.addStoredAnimation(clone);
            } else {
                clone = anim.clone(robots);
                cloned.set(anim, clone);
                this.addStoredAnimation(clone);
            }
        }

        return this;
    }

    /**
     * Clones this AnimationManager and returns the clone.
     * @param robots The robot map to map the Robots of the animations of this
     * AnimationManager to their clones.
     */
    clone(robots: Map<Robot, Robot>): AnimationManager {
        return (new AnimationManager()).copy(this, robots);
    }

    // ------------------
    // Serialization

    serialize():serialized_animation_manager {
        let activeAnimations = [];

        for (const animation of this._activeAnimations) {
            activeAnimations.push(animation.serialize());
        }

        let storedAnimations = [];
        for (const animation of this._storedAnimations) {
            storedAnimations.push(animation.serialize());
        }

        return {
            activeAnimations: activeAnimations,
            storedAnimations: storedAnimations,
            lastTime: this._lastTime,
        };
    }

    static async deserialize(serial:serialized_animation_manager, objsById:Map<string, Robot>, atsById:Map<string, AnimationTable>, donor?:AnimationManager):Promise<AnimationManager> {
        let _donor:AnimationManager = donor ? donor : new AnimationManager();

        // Deserialize Active animations and stored animations concurrently
        let activeAnimationProms:Promise<AnimationGroup>[] = []
        if (serial.activeAnimations)
            for (const anim of serial.activeAnimations)
                activeAnimationProms.push(AnimationGroup.deserialize(anim, objsById, atsById));

        let storedAnimationProms:Promise<AnimationGroup>[] = []
        if (serial.storedAnimations)
            for (const anim of serial.storedAnimations)
                storedAnimationProms.push(AnimationGroup.deserialize(anim, objsById, atsById));

        // Wait for both lists to finish deserializing
        let activeAnimations = await Promise.all(activeAnimationProms);
        let storedAnimations = await Promise.all(storedAnimationProms);

        for (const anim of activeAnimations) _donor.addActiveAnimation(anim);
        for (const anim of storedAnimations) _donor.addStoredAnimation(anim);

        if (serial.lastTime) _donor._lastTime = serial.lastTime;
        return _donor;
    }
}