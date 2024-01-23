import { Animation, serialized_animation } from "./Animation";
import { AnimationTable } from "./AnimationTable";
import { APP } from "./constants";
import { Robot } from "./objects3D/Robot";

export interface serialized_animation_group {
    name?: string,
    animations?: serialized_animation[],
}

//function deserialError(message:string):string {
//    message = `An AnimationGroup could not be deserialized: ${message}`;
//    APP.error(message);
//    return message;
//}

/**
 * A group of animations that are all animated at the same time.
 */
export class AnimationGroup {
    protected _name: string;
    protected _animations: Animation[];

    /**
     * Constructs a new AnimationGroup object.
     * @param animations The Animations to start out with (for conveience.)
     */
    constructor(name:string='Animation Group', animations:Animation[] = []) {
        this._name = name;
        this._animations = [...animations];
    }

    setName(name:string) {
        this._name = name;
        APP.updateUI();
    }

    name():string {
        return this._name;
    }

    startTime():number {
        let min = Infinity;
        for (const anim of this._animations) {
            min = Math.min(min, anim.startTime())
        }
        if (min === Infinity) min = 0;
        return min;
    }

    endTime():number {
        let max = -Infinity;
        for (const anim of this._animations) {
            max = Math.max(max, anim.endTime())
        }
        if (max === -Infinity) max = 1;
        return max;
    }

    /**
     * Updates all the animations of the group based on the
     * given time of the animation.
     * @param totalTime The current time of the animation.
     */
    update(totalTime:number) {
        for (const anim of this._animations) {
            anim.update(totalTime);
        }
    }

    animations():Animation[] {
        return this._animations;
    }

    addAnimation(animation:Animation) {
        // No duplicates
        if (this._animations.indexOf(animation) !== -1) return;
        this._animations.push(animation);
        APP.updateUI();
    }

    removeAnimation(animation:Animation) {
        let i = this._animations.indexOf(animation);
        if (i >= 0) {
            this._animations.splice(i, 1);
            APP.updateUI();
        }
    }

    /**
     * Copies this AnimationGroup and returns the copy.
     * @param robots The robot map to map the Robots of the animations of this
     * AnimationGroup to their copies.
     */
    copy(animGroup: AnimationGroup, robots: Map<Robot, Robot>): AnimationGroup {
        this._name = animGroup.name();

        for (const anim of animGroup._animations) {
            this.addAnimation(anim.clone(robots));
        }
        return this;
    }

    /**
     * Clones this AnimationGroup and returns the clone.
     * @param robots The robot map to map the Robots of the animations of this
     * AnimationGroup to their clones.
     */
    clone(robots: Map<Robot, Robot>): AnimationGroup {
        return (new AnimationGroup()).copy(this, robots);
    }

    /**
     * Serializes this AnimationGroup.
     */
    serialize():serialized_animation_group {
        let animations:serialized_animation[] = [];

        for (const animation of this._animations) {
            animations.push(animation.serialize());
        }

        return {
            name: this._name,
            animations: animations,
        };
    }

    /**
     * Deserializes an AnimationGroup object that was serialized.
     * 
     * @param objsById The animatable objects that should have been loaded in
     * BEFORE the AnimationGroup is deserialized so that it can now look them
     * up by ID.
     * @param atsById same as objsById but for AnimationTables.
     * @returns A Promise that resolves to a deserialized AnimationGroup.
     */
    static async deserialize(serial:serialized_animation_group, objsById:Map<string, Robot>, atsById:Map<string, AnimationTable>, donor?:AnimationGroup):Promise<AnimationGroup> {
        let _donor:AnimationGroup = donor ?? new AnimationGroup();
        let animations = serial.animations;

        if (animations) {
            if (serial.name) _donor._name = serial.name;

            let animsProms:Promise<Animation>[] = [];
            for (const animation of animations) {
                animsProms.push(Animation.deserialize(animation, objsById, atsById));
            }
            let anims = await Promise.all(animsProms);
            for (const anim of anims) {
                _donor.addAnimation(anim);
            }
        }

        return _donor;
    }
}