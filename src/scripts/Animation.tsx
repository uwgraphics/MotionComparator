import { AnimationTable } from "./AnimationTable";
import { APP } from "./constants";
import { lerp } from "./helpers";
import { Robot } from "./objects3D/Robot";

export interface serialized_animation {
    objectId: string,
    animationTableId: string,
    offset: number,
    lengthen: number,
}

/**
 * Response to reaching the end of the Animation.
 */
//export class END_RESPONSE {
//    static STOP = "STOP";     // When reach end of the animation, just make the robot stop there
//    static BOUNCE = "BOUNCE"; // Start rewinding the animation, then (when it reaches the start) go forward through it again and repeat
//    static WRAP = "WRAP";     // Restart the animation when it reaches the end
//}

function deserialError(message:string):string {
    message = `Could not deserialize Animation: ${message}`;
    APP.error(message);
    return message;
}

/**
 * Manages the start, stop, and continuation of the animation of a single Animatable object.
 */
export class Animation {
    protected _object: Robot;
    protected _animationTable: AnimationTable;
    protected _offset: number; // How many seconds to offset the start of the animation by
    protected _lengthen: number; // How many seconds to lengthen the animation by

    /**
     * Constructs an Animation object.
     * @param object The object to animate.
     * @param animationTable The animation table to to animate the Robot using.
     * @param offset The number of seconds to offset the start of the animation
     * by. The higher the number, the later it should start and the lower the
     * number (even into the negatives) the earlier the animation should start
     * in the overall animation.
     */
    constructor(object:Robot, animationTable:AnimationTable, offset:number=0, lengthen:number=0) {
        this._object = object;
        this._animationTable = animationTable;
        this._offset = offset;
        this._lengthen = lengthen;
    }

    /**
     * Copies this Animation and returns the copy.
     * @param robots The robot map to map the Robots of the animations of this
     * Animation to their copies.
     */
    copy(anim: Animation, robots: Map<Robot, Robot>): Animation {
        let robot = robots.get(anim._object);
        if (robot === undefined) {
            throw Error(`Object ${this._object.name()}  could not be mapped to a copy!`);
        }

        this._object = robot;
        this._animationTable = anim._animationTable.clone();
        this._offset = anim._offset;
        this._lengthen = anim._lengthen;
        return this;
    }

    /**
     * Clones this Animation and returns the clone.
     * @param robots The robot map to map the Robots of the animations of this
     * Animation to their clones.
     */
    clone(robots: Map<Robot, Robot>): Animation {
        let robot = robots.get(this._object);
        if (robot === undefined) {
            throw Error(`Object ${this._object.name()} could not be mapped to a clone!`);
        }
        return new Animation(robot, this._animationTable.clone(), this._offset, this._lengthen);
    }

    objectAnimating(): Robot {
        return this._object;
    }

    animationTable(): AnimationTable {
        return this._animationTable;
    }

    startTime():number {
        return this._animationTable.startTime() + this._offset;
    }

    endTime():number {
        return this._animationTable.endTime() + this._offset + this._lengthen;
    }

    /**
     * Updates this Robot so that it is positioned based on the given time of
     * the animation.
     * @param currentTime The global time of the animation in seconds (so time
     * within range [startTime, endTime]).
     */
    update(currentTime:number) {
        currentTime += this._offset;
        let [startTime, endTime] = [this.startTime(), this.endTime()];

        // Basically, this._lengthen has lengthened the total time of the
        // animation so we need to find the percentage of the change
        // when compared to the old length of the animation and then apply
        // that percentage equally accross the full animation.
        let zEndTime = endTime + startTime;
        let zCurrTime = currentTime + startTime;
        let timeToSubtract = lerp(0, this._lengthen, zCurrTime / zEndTime);
        currentTime -= timeToSubtract;

        if (currentTime < startTime) currentTime = startTime;
        if (currentTime > endTime) currentTime = endTime;

        // Actually pose the animatable object as it should be for the current
        // time.
        let frame = this._animationTable.frame(currentTime, this._object.name());
        this._object.applyFrame(frame);
    }

    /**
     * Sets the offset of when this animation begins.
     * @param offset The number of seconds to offset the start of the animation
     * by. The higher the number, the later it should start and the lower the
     * number (even into the negatives) the earlier the animation should start
     * in the overall animation.
     */
    setOffset(offset:number) {
        this._offset = offset;
        APP.render();
        APP.updateUI();
    }

    /**
     * Returns the object that is binded to this animation
     * @returns 
     */
    robot():Robot{
        return this._object;
    }

    /**
     * Returns the offset of this animation in seconds.
     * @returns The offset in seconds.
     */
    offset():number {
        return this._offset;
    }

    setLengthen(lengthen:number) {
        this._lengthen = lengthen;
        APP.render();
        APP.updateUI();
    }

    /**
     * Returns how many seconds the animation is lengthened by.
     * @returns How many seconds the animation is lengthened by.
     */
    lengthen():number {
        return this._lengthen;
    }

    /**
     * Serializes this Animation.
     * 
     * Note: Because the Animation deals with an object but does not own it it
     * must serialize it as an ID and then look it up by ID later.
     */
    serialize():serialized_animation {
        return {
            objectId: this._object.idValue(),
            animationTableId: this._animationTable.idValue(),
            offset: this._offset,
            lengthen: this._lengthen,
        };
    }

    /**
     * Deserializes an Animation object that was serialized.
     * 
     * @param objsById The animatable objects that should have been loaded in
     * before hand in a Map with their keys being their Ids.
     * BEFORE the Animation is deserialized so that it can now look them up by ID.
     */
    static async deserialize(serial:serialized_animation, objsById:Map<string, Robot>, atsById:Map<string, AnimationTable>, donor?:Animation):Promise<Animation> {
        let obj = objsById.get(serial.objectId);
        if (obj) {
            // Object was found
            let animatable:Robot = obj;

            let animationTableId = serial.animationTableId;

            if (animationTableId) {
                let at = atsById.get(animationTableId);

                if (at) {
                    if (!donor) {
                        return  new Animation(animatable, at, serial.offset, serial.lengthen);
                    } else {
                        donor._object = animatable;
                        donor._animationTable = at;
                        if (serial.offset) donor._offset = serial.offset;
                        if (serial.lengthen) donor._offset = serial.lengthen;
                        return donor;
                    }
                } else {
                    throw deserialError(`An animation table with ID ${animationTableId} could not be found.`);
                }
            } else {
                throw deserialError(`AnimationTable seral was not present while deserializing Animation.`);
            }
        } else {
            throw deserialError(`Uknown object ID "${serial.objectId}"`);
        }
    }
}