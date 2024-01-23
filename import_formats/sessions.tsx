import { LayoutBase } from "rc-dock";
import { camera_type, world_frames } from "../src/scripts/scene/RobotScene";

/**
 * If you would like to import one or more sessions (each with one or more scenes) into
 * the Application, this is the format that you should use to do so. If you only care about
 * 1 scene, then just import 1 session with that 1 scene.
 *
 * NOTE: All id's in the Json should be unique strings for this particular Json
 *   i.e. within this json, no two id's should be the same. The id's are thrown away
 *   after the objects are loaded in and connected using them.
 * NOTE: Multiple objects can have the same name and that name will be shown to
 *   the user.
 */
export interface sessions_import_format {
    saveFormatVersion?: "1.0", // If not given, the format is assumed to be version "1.0"

    layout?: LayoutBase,
    
    times?:{ // time data for the animation
        currentTime: number,
        currentStartTime: number,
        currentEndTime: number,
    }

    // The URDFs of the objects that you want loaded into the scene.
    // NOTE: There should be one URDF per object in the scene.
    objects: {
        type: "urdf" | "gltf" | "AxesHelper", // case insensitive
        id: string, // Every ID must be unique for the list of objects

        // url and/or str needs to be provided
        url: string, // The URDF should be in something like a public GitHub repo where an access token is not necessary
        //content?: string, // URDF/GLTF as a single string *WARNING: ONLY SUPPORTS URDF RIGHT NOW*
    
        name: string, 
    }[];

    // An animation CSV animates one or more of the URDFs loaded in using the
    //   information in the `objects` array above.
    // The animation CSV has special column names as follows:
    //     Position: "X_POS", "Y_POS", "Z_POS"
    //     Rotation: "X_ROT", "Y_ROT", "Z_ROT", "W_ROT" (W_ROT is for quaternion, if not present then assumes it is an XYZ euler rotation value)
    //     Scale   : "X_SCALE", "Y_SCALE", "Z_SCALE"
    //   These column names each animate one value of the sceneObject and are
    //   case-insensitive.
    //
    //   If the column name does not have one of these, then it is assumed that
    //   the column is an joint's name and animate's the joint's angle value.
    //
    //   If the column should animate a specific sceneObject, then prefix
    //   sceneObject's name to the column. Otherwise, the column animates
    //   any sceneObject the animation CSV is hooked up to.
    animations: {
        id: string,
        timeUnit?: "second" | "millisecond" | "microsecond" | "nanosecond", // auto-detected if not sent, case-insensitive if given

        name?: string, // The name shown in the editor. If undefined, name will be "Unnamed Animation"

        // At least one of these must be provided
        url?: string,         // Give if you can directly get the CSV via a Get request of the URL
        //apiFetchURL?: string,
        //apiUpdateFetchURL?: string,
        content?: (string | number)[][], // First row is all strings -- headers -- all rows after that should be full of numbers
    }[];

    // This maps out the sessions and their scenes.
    scenes: {
        name?: string; // the name of the scene, not required in the original format
        originalId?: string, // the id of the scene, not required in the original format
        path: string[], // used to build the folder-structure by sorting the path at each level
        metrics: { [key:string]: string},
        threeObjects: {
            objectID: string, // Id of object in "objects" array

            robotID?: string, // the original id of the robot (may be different from objectId), not required in the original format

            isviewpoint: boolean, // when viewpoint is selected, the object is hidden

            animationID: string[], // list of animations to bind to this object. The "name" below should be prefixed to any column of the CSV that you want to animate this object instance
            name: string, // name of object (should correspond to prefix of column in AnimationCSV)

            // Initial values (overriden as soon as animation begins or never if no
            // animation is provided)

            // Missing x,y,z values are assumed to be 0

            position?: {
                x?:number,
                y?:number,
                z?:number,
            },

            rotation?: {
                x?:number,
                y?:number,
                z?:number,
                w?:number, // If given, assumes that the rotation is a quaternion
            },

            scale?: {
                x?:number,
                y?:number,
                z?:number,
            },

            joints?: {
                name:string,  // must match up with the name of the joint in the URDF
                angle:number, // These should be radians
            }[],

            // Offsets are manually added by users and are not overwritten by
            // animations. 

            positionOffset?: {
                x?:number,
                y?:number,
                z?:number,
            },

            rotationOffset?: {
                x?:number,
                y?:number,
                z?:number,
                w?:number, // If given, assumes that the rotation is a quaternion
            },

            scaleOffset?: {
                x?:number,
                y?:number,
                z?:number,
            },
        }[],

        
        traces?:{
            robotId: string,
            robotPartName: string,
            parentSceneId: string,
            currSceneId: string,
            originalId: string,
        }[],

        backgroundColor?: string;
        directionalLightIntensity?: number;
        ambientLightIntensity?: number;
        showGroundPlane?: boolean;
        cameraType?: camera_type;
        worldFrame?: world_frames;
        showWorldFrameObject?: boolean;
        axisDensity?: number;
        axisSize?: number;
        traceSize?: number;

        isTimeWarped?: boolean;
        timeWarpBaseSceneId?: string;
        keyObjects?: string[];

        arrows?:{
            traceFromId: string,
            traceToId: string,
            parentSceneId: string,
        }[]
    }[],

    quaternionScenes?:{
        name: string,
        originalId: string,
        backgroundColor: string,
        lineGroupOpacity: number,
        lineGroupColor: string,
        showWorldFrameObject: boolean;

        traces:{
            robotId: string,
            robotPartName: string,
            parentSceneId: string,
        }[],
    }[],

    graphs?:{
        name: string,
        originalId: string,
        isDiff: boolean,
        isTimeWarp: boolean,

        currProperty: string,
        line_ids: string[],

        lineWidth: number, // the stoke size of the curves displayed in the graph
        backgroundColor: string, // the background color of the graph
        axisColor: string, // the axis color of the graph
        filter?: number,
    }[],

    umapGraphs?:{
        name: string,
        originalId: string,

        line_ids: string[],

        lineWidth: number, // the stoke size of the curves displayed in the graph
        backgroundColor: string, // the background color of the graph
        axisColor: string, // the axis color of the graph
    }[],
}