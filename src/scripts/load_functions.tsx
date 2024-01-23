import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader'
import { AssertionError } from 'assert';
import URDFLoader, { URDFRobot } from "urdf-loader";
import { APP } from './constants';
import { enumerate, parseCSVFromString } from "./helpers";
import { loadGoogleSheetsData, isGoogleURL, spreadsheetIdFromSpreadsheetURL } from './google_api';
import T from './true_three';

/**
 * Fetches a blob of data from the given url.
 * @param url The url to fetch from.
 * @returns A promise that resolves to the Blob resulting from the fetch.
 */
export async function fetchFromURL(url:string, options?:RequestInit):Promise<Blob> {
    let res = await fetch(url, options);
    let blob = await res.blob();
    return blob;
}

/**
 * Gets the content of the blob as Text. If the blob is from a file, then it
 * will read in the contents of the file.
 * @param blob The blob to read as text.
 * @returns A promise that resolves to the text content of the given blob.
 */
export async function readBlobAsText(blob:Blob):Promise<string> {
    return new Promise((resolve, reject) => {
        let fr = new FileReader();
        fr.onload = function () {
            resolve(fr.result as string);
        }
        fr.readAsText(blob);
    });
}

interface named_csv {
    name: string,
    csv: (string | number)[][],
}

async function loadCSVFromGoogleSheetsURL(url:string, includeNames:true):Promise<named_csv[]>;
async function loadCSVFromGoogleSheetsURL(url:string, includeNames?:false):Promise<(string | number)[][][]>;

/**
 * Loads a Google Sheets spreadsheet as one or more CSVs.
 * @param url The url to the Google Sheets spreadsheet to load the CSV from.
 * @param includeNames Whether to return a unique (for the csvs gotten from the
 * url) for each CSV with each CSV.
 */
async function loadCSVFromGoogleSheetsURL(url:string, includeNames:boolean=false):Promise<(string | number)[][][] | named_csv[]> {
    url = url.trim().replace('\\', '/');

    if (!isGoogleURL(url)) {
        throw new AssertionError({
            message:`URL "${url}" does not appear to be from google sheets so it cannot be used to get a CSV.`
        });
    }

    let spreadsheetId = spreadsheetIdFromSpreadsheetURL(url);
    let res = await loadGoogleSheetsData({spreadsheetId});

    if (includeNames) {
        let arr:named_csv[] = []
        for (const sheet of res.sheets) {
            for (const [dataI, sheetData] of enumerate(sheet.data)) {
                if (sheetData.data) {
                    let name = `GoogleSheets_${sheet.title}`;
                    if (sheet.data.length > 1) {
                        name += `_${dataI + 1}`;
                    }
                    arr.push({
                        name: name,
                        csv: sheetData.data
                    });
                }
            }
        }
        return arr;
    } else {
        let arr:(string | number)[][][] = [];
        for (const sheet of res.sheets) {
            for (const sheetData of sheet.data) {
                if (sheetData.data) {
                    arr.push(sheetData.data);
                }
            }
        }
        return arr;
    }
}

export async function loadCSVFromLocalFile(file:File, includeNames:true):Promise<named_csv[]>;
export async function loadCSVFromLocalFile(file:File, includeNames?:false):Promise<(string | number)[][][]>;

export async function loadCSVFromLocalFile(file:File, includeNames:boolean=false):Promise<(string | number)[][][] | named_csv[]> {
    if (includeNames) {
        let ret = await loadCSVFromURL(URL.createObjectURL(file), includeNames);
        for (const v of ret) {
            v.name = file.name;
        }
        return ret;
    } else {
        return await loadCSVFromURL(URL.createObjectURL(file), includeNames);
    }
}

export async function loadCSVFromURL(url:string, includeNames:true):Promise<named_csv[]>;
export async function loadCSVFromURL(url:string, includeNames?:false):Promise<(string | number)[][][]>;

/**
 * Loads CSV files into an arr and does a call back function on the array
 * after parsing.
 * 
 * Warning: this method does NOT clean the CSV at all. Use `cleanCSV` from the 
 * helpers module to clean the CSV.
 * 
 * Note: this function also parses .rmoo files.
 * 
 * @param url the URL of the CSV.
 * @param includeNames Whether to return a unique (for the csvs gotten from the
 * url) for each CSV with each CSV.
 * @returns A Promise that resolves to one or more CSVs gotten from the given
 * URL.
 */
export async function loadCSVFromURL(url:string, includeNames:boolean=false):Promise<(string | number)[][][] | named_csv[]> {
    url = url.trim();

    if (url.startsWith("https://docs.google.com/spreadsheets/d/")) {

        // I have to do this unnecessary if statement for TypeScript to be happy >:^(
        if (includeNames) {
            return loadCSVFromGoogleSheetsURL(url, includeNames);
        } else {
            return loadCSVFromGoogleSheetsURL(url, includeNames);
        }

    } else {
        let blob = await fetchFromURL(url);
        let data = await readBlobAsText(blob);

        let csv: (string | number)[][] = Array.from(parseCSVFromString(data));

//        // Split CSV and return it
//        let csv = data.split(/\r\n|\n/).map((line) => {
//            return line.replace(/\[([^\s]*,)*[^\s]?\]\s*,/, '0').split(/,|;/);
//        });

        if (includeNames) {
            let nameL = url.replace('\\', '/').trim().split('/');
            let name = nameL[nameL.length - 1];
            return [{
                name: name,
                csv: csv,
            }];
        } else {
            return [csv];
        }
    }
}


/**
 * 
 * @param url The url to find that .glb file to load the Object3D from.
 * @returns The loaded Object3D.
 */
export async function loadObject3DFromGlbUrl(url:string): Promise<T.Object3D> {
    let response = await fetch(url);
    if (response.ok) {
        let loader = new GLTFLoader();
        return await new Promise((resolve, reject) => {
            loader.load(url, (gltf:GLTF) => {
                resolve(gltf.scene);
            }, () => {}, () => {
                reject(`Could not load GLB from url "${url}"`)
            })
        });
    } else {
        throw new Error(`Bad response from url "${url}" when trying to load GLB object`);
    }
}


/**
 * Gets the content of URDF files that are stored locally.
 * @param files The files to get the URDF from.
 * @param func The callback function to call if the files are found.
 * 
 * WARNING: This is currently not not in use and untested and so it is unknown
 * if it still works
 */
//function loadURDFFromLocal(files:FileList | File[], func: (blob:Blob) => void) {
//    let fileArray = Array.from(files);
//    let urdfFiles = fileArray.filter(file => file.name.endsWith(".urdf"));
//    let daeFiles = fileArray.filter(file => file.name.endsWith(".dae"));
//    let stlFiles = fileArray.filter(file => file.name.endsWith(".stl"));
//    let DAEFiles = fileArray.filter(file => file.name.endsWith(".DAE"));
//    let STLEFiles = fileArray.filter(file => file.name.endsWith(".STL"));
//    
//    let dataFiles = daeFiles.concat(stlFiles).concat(DAEFiles).concat(STLEFiles)
//    //console.log(dataFiles)
//
//    loadMeshFiles(dataFiles, fileArray, (map) => {
//        let urdfStr:string;
//        let fr = new FileReader();
//        fr.onload = function () {
//            urdfStr = (fr.result as string);
//            fileArray.forEach(file => {
//                let path = file.name;
////                let tag = "";
////                if (/\.stl$/i.test(path)) {
////                    tag = ".stlX"
////                } else if (/\.dae$/i.test(path)) {
////                    tag = ".daeX"
////                }
//                let replaceLink = "package://" + path;
//                let newLink = map.get(replaceLink)
//                if (typeof newLink === 'string') {
//                    urdfStr = urdfStr.replaceAll(replaceLink, newLink);
//                } else {
//                    console.error(`map.get(${newLink}) returns undefined!`);
//                }
//            })
//            func(PlainTextBlob(urdfStr));
//        }
//        if (urdfFiles.length > 0) {
//            for (const file of urdfFiles) {
//                fr.readAsText(file);
//            }
//        } else {
//            console.error("urdfFile is undefined!");
//        }
//    });
//}

/**
 * Retreives a URDF file from a URL, reads it, does necessary modifications,
 * and returns it as a URDFRobot.
 * @param url URL to get the URDF from.
 * @returns A promise that resolves to the loaded URDF in Blob form.
 */
export async function loadURDFFromURL(url:string):Promise<URDFRobot> {
    // First, get the URDF file contents and modify it so that all the
    // links to various other files it needs are loaded in and modified
    // to be correct (the URLs are all messed up because it would be a
    // security risk if they weren't s we need to make them all work)
    let imageMap = new Map();

    let urdfBlob = await fetchFromURL(url);
    let urdfStr = await readBlobAsText(urdfBlob);

    let parser = new DOMParser();
    let xml = parser.parseFromString(urdfStr, "text/xml");
    let meshes = Array.from(xml.getElementsByTagName("mesh"));

    let modifiedBlob: Blob;
    if (meshes.length === 0) {
        modifiedBlob = PlainTextBlob(urdfStr);
    } else {
        // Concurrently fetch all the mesh files from their URL's
        let meshBlobVals:[string, string][] = [];
        let meshBlobs:Promise<Blob>[] = [];
        for (const mesh of meshes) {
            //@ts-ignore
            let filePath:string = mesh.attributes.filename.nodeValue;
            //console.log(filePath)
            let urdfFolder = url.substring(0, url.lastIndexOf("/"));
            let meshURL = filePath.replace("package://", urdfFolder + "/../../").replaceAll("#", "%23");

            meshBlobVals.push([filePath, meshURL]);
            meshBlobs.push(fetchFromURL(meshURL));
        }

        // Wait for all the meshes to finish fetching
        let doneMeshBlobs = await Promise.all(meshBlobs);

        // Now that all meshes have been fetched, process them a bit
        for (const [i, meshBlob] of enumerate(doneMeshBlobs)) {
            let [filePath, meshURL] = meshBlobVals[i];

            let tag = "";
            if (/\.stl$/i.test(filePath)) {
                tag = ".stlX"
                let blobURL = URL.createObjectURL(meshBlob);
                let newLink = blobURL.substring(blobURL.lastIndexOf("/") + 1).trim() + tag;
                let replaceLink = filePath;
                urdfStr = urdfStr.replace(replaceLink, newLink);
            } else if (/\.dae$/i.test(filePath)) {
                tag = ".daeX"
                let newMeshBlob = await loadDAEFromURL(meshBlob, imageMap, meshURL);

                let blobURL = URL.createObjectURL(newMeshBlob);
                let newLink = blobURL.substring(blobURL.lastIndexOf("/") + 1).trim() + tag;
                let replaceLink = filePath;
                urdfStr = urdfStr.replace(replaceLink, newLink);
            }
        }

        modifiedBlob = PlainTextBlob(urdfStr);
    }

    // Now that the URDF file's contents have been modified to be correct for
    // this machine, we should load the URDF into a URDFRobot object.

    // url of the modified URDF file (just created and now hosted locally on
    // this computer/server)
    const newURL = URL.createObjectURL(modifiedBlob);

    // Have to use seperate Promise so that we can use the resolve or reject
    // callbacks to return the data when done becasue the data we need to return
    // is found in other callbacks
    return await new Promise<URDFRobot>((resolve, reject) => {
        let urdfRobot: URDFRobot;

        let loadingManager = new T.LoadingManager();
        let urdfLoader = new URDFLoader(loadingManager);
        urdfLoader.parseVisual = true;
        urdfLoader.parseCollision = false; // URDFs have collision objects inside them, ignore them because we only care about the visible outside parts of the mesh

        // Begins the loading of all parts of the URDF
        urdfLoader.load(newURL, (urdfRobot_:URDFRobot) => {
            urdfRobot = urdfRobot_;
        });

        // This method is called when ALL parts of the URDF are finished
        // loading
        loadingManager.onLoad = () => {
            resolve(urdfRobot);
        }

        // This is run when an error in the loading occurs
        loadingManager.onError = (url) => {
            let error = `Failed to load URDF from URL "${url}".`;
            APP.error(error);
            reject(error);
        }
    });
}

/**
 * Loads the given meshFiles and then calls the given callback function with them.
 * @param meshFiles The array of meshfiles.
 * @param fileArray The array of other files.
 * @param func The callback function to call once all the files are loaded.
 */
//function loadMeshFiles(meshFiles:File[], fileArray:File[], func: (arg:Map<string, string>) => void) {
//    let meshMap = new Map<string, string>();
//    let recursiveDAEModify = (meshFiles:File[], fileArray:File[], index:number) => {
//        let meshFile = meshFiles[index];
//
//        let fr = new FileReader();
//        fr.onload = function () {
//            let daeStr = (fr.result as string);
//            for (const file of fileArray) {
//                let path = file.webkitRelativePath;
//                let fileURL = URL.createObjectURL(file);
//                let newLink = fileURL.substring(fileURL.lastIndexOf("/") + 1).trim()// + tag;
//                let replaceLink = path.substring(path.lastIndexOf("/") + 1).trim();
//                daeStr = daeStr.replaceAll(replaceLink, newLink);
//            }
//            let blob = PlainTextBlob(daeStr);
//            let meshURL = URL.createObjectURL(blob)
//            let oldLink = "package://" + meshFile.name;
//            let newLink = meshURL.substring(meshURL.lastIndexOf("/") + 1).trim() + ".daeX";
//            // console.log("loadMeshFile:", oldLink, newLink)
//            meshMap.set(oldLink, newLink)
//            recursiveDAEModify(meshFiles, fileArray, index)
//        }
//
//        if(meshFile) {
//            index++;
//            if(meshFile.name.includes(".dae") || meshFile.name.includes(".DAE")) {
//                fr.readAsText(meshFile);
//            } else if (meshFile.name.includes(".stl") || meshFile.name.includes(".STL")) {
//                let meshURL = URL.createObjectURL(meshFile)
//                let oldLink = "package://" + meshFile.webkitRelativePath;
//                let newLink = meshURL.substring(meshURL.lastIndexOf("/") + 1).trim() + ".stlX";
//                // console.log("loadMeshFile:", oldLink, newLink)
//                meshMap.set(oldLink, newLink)
//                recursiveDAEModify(meshFiles, fileArray, index);
//            } else {
//                console.error("unknown file type: ", meshFile.name)
//            }
//        } else {
//            func(meshMap);
//        }
//    }
//
//    recursiveDAEModify(meshFiles, fileArray, 0) // Begin recursion
//}

/**
 * Loads a DAE file from a URL and calls the callback function with it.
 * @param meshBlob The blob version of the mesh.
 * @param imageMap The image map to use.
 * @param meshURL The URL of the mesh.
 * @returns A Promise that resolves to the contents of the DAE file.
 */
async function loadDAEFromURL(meshBlob:Blob, imageMap:Map<string, any>, meshURL:string):Promise<Blob> {
    let meshStr = await readBlobAsText(meshBlob);

    let parser = new DOMParser();
    let xml = parser.parseFromString(meshStr, "text/xml");
    let images = Array.from(xml.getElementsByTagName("image"));
    let newImages:string[] = []; // list of new image locations

    for (const image of images) {
        //@ts-ignore
        let imageFile = image.childNodes[1].innerHTML;
        let imageURL = meshURL.substring(0, meshURL.lastIndexOf("/") + 1) + imageFile;
        if(!imageMap.get(imageURL)) {
            imageMap.set(imageURL, {
                imageFile: imageFile
            })
            newImages.push(imageURL)
        } else {
            if(imageMap.get(imageURL).newLink) {
                meshStr = meshStr.replace(imageMap.get(imageURL).imageFile, imageMap.get(imageURL).newLink);
            } else {
                newImages.push(imageURL)
            }
        }
    }

    if(newImages.length === 0) {
        let modifiedBlob = PlainTextBlob(meshStr);
        return modifiedBlob;
    } else {
        let imageBlobs:[string, Blob][] = [];

        // Load in all images
        for (const imageURL of newImages) {
            imageBlobs.push([imageURL, await fetchFromURL(imageURL)]);
        }

        // Change the urls in the file to match the new image paths (because the
        // actual fetched paths are obscured by the browser for security
        // reasons).
        for (const [imageURL, imageBlob] of imageBlobs) {
            let blobURL = URL.createObjectURL(imageBlob);
            let newLink = blobURL.substring(blobURL.lastIndexOf("/") + 1).trim(); // Get file name at end so from path like "C:/pie.text" it gets "pie.text" and that's the images new name
            meshStr = meshStr.replace(imageMap.get(imageURL).imageFile, newLink);
            imageMap.get(imageURL).newLink = newLink;
        }

        let modifiedBlob = PlainTextBlob(meshStr);
        return modifiedBlob;
    }
}

/**
 * Loads a json file from the given url and returns a Promise that resolves to
 * the resulting object.
 * @param url The URL of the json file to load.
 * @returns a Promise that resolves to the requested json as a JavaScript object.
 */
export async function loadJsonFromURL(url:string):Promise<object> {
    let blob = await fetchFromURL(url);
    let jsonText = await readBlobAsText(blob);
    let json = JSON.parse(jsonText);
    return json;
}

/**
 * Loads a Json file, parses it, and returns the resulting object.
 * @param file The local file to load the Json from.
 * @returns A promise that resolves to the result of parsing the contents of the
 * retreived json file.
 */
export async function loadJsonFromLocalFile(file:File):Promise<object> {
    let jsonStr = await readBlobAsText(file);
    return JSON.parse(jsonStr);
}

/**
 * Helper function that returns a new plain text Blob object.
 * @param text The plain text to put in a blob.
 */
function PlainTextBlob(text:string | File):Blob {
    return new Blob([text], { type: 'text/plain' });
}