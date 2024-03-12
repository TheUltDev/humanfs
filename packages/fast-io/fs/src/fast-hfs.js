/**
 * @fileoverview The main file for the hfs package.
 * @author MediaFire
 */

/* global navigator */

//-----------------------------------------------------------------------------
// Types
//-----------------------------------------------------------------------------

/** @typedef{import("@humanfs/types").HfsImpl} HfsImpl */
/** @typedef{import("fastio-types").FastFileList} FastFileList */
/** @typedef{import("fastio-types").FastFileDetails} FastFileDetails */
/** @typedef{import("wretch").Wretch} Wretch */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import {
	Hfs,
	Path,
	NotFoundError,
	DirectoryError,
	NotEmptyError,
} from "@humanfs/core";

import wretch from "wretch";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const FASTIO_API = "https://api.fast.io/api/v1.0";

/**
 * Finds a file or directory in the FastIO workspace.
 * @param {Wretch} api The FastIO API.
 * @param {string} opaqueId The id of the file or directory.
 * @returns {Promise<FastFileDetails|undefined>} The file or directory found.
 */
async function getDetails(api, opaqueId) {
	// TODO: Implement this method
}

/**
 * Reads a file from the specified root.
 * @param {Wretch} api The FastIO API.
 * @param {string} opaqueId The id of the file or directory.
 * @param {"text"|"arrayBuffer"} dataType The type of data to read.
 * @returns {Promise<string|ArrayBuffer|undefined>} Resolves with the
 * 	contents of the file or undefined if the file does not exist.
 */
async function readFile(api, opaqueId, dataType) {
	const handle = await getDetails(api, opaqueId);

	if (!handle || handle.kind !== "file") {
		return undefined;
	}

	const fileHandle = /** @type {FastFileDetails} */ (handle);
	const file = await fileHandle.getFile();

	if (dataType === "arrayBuffer") {
		return file.arrayBuffer();
	}

	return file.text();
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A class representing the FastIO implementation of Hfs.
 * @implements {HfsImpl}
 */
export class FastHfsImpl {
	/**
	 * The FastIO API.
	 * @type {Wretch}
	 */
	#api;

	/**
	 * Creates a new instance.
	 * @param {object} options The options for the instance.
	 * @param {string} options.apiKey The API key for the account.
	 * @param {string} options.workspaceId The workspace to target.
	 * @throws {TypeError} If options.apiKey is not provided.
	 * @throws {TypeError} If options.workspaceId is not provided.
	 */
	constructor({ apiKey, workspaceId }) {
		if (!apiKey) {
			throw new TypeError("options.apiKey is required");
		}

		if (!workspaceId) {
			throw new TypeError("options.workspaceId is required");
		}

		this.#api = wretch(`${FASTIO_API}/workspace/${workspaceId}/storage`, { mode: "cors" })
			.errorType("json")
			.resolve(r => r.json())
	}

	/**
	 * Reads a file and returns the contents as an Uint8Array.
 	 * @param {string} opaqueId The id of the file.
	 * @returns {Promise<Uint8Array|undefined>} Resolves with the contents of the file
	 * 	or undefined if the file does not exist.
	 * @throws {Error} If the file cannot be read.
	 * @throws {TypeError} If the file path is not a string.
	 */
	async bytes(opaqueId) {
		const buffer = /** @type {ArrayBuffer|undefined} */ (
			await readFile(this.#api, opaqueId, "arrayBuffer")
		);
		return buffer ? new Uint8Array(buffer) : undefined;
	}

	/**
	 * Writes a value to a file. If the value is a string, UTF-8 encoding is used.
 	 * @param {string} opaqueId The id of the file.
	 * @param {Uint8Array} contents The contents to write to the file.
	 * @returns {Promise<void>} Resolves when the file is written.
	 * @throws {TypeError} If the file path is not a string.
	 * @throws {Error} If the file cannot be written.
	 */
	async write(opaqueId, contents) {
		let handle = /** @type {FastFileDetails} */ (
			await getDetails(this.#api, opaqueId)
		);

		if (!handle) {
			const path = Path.from(opaqueId);
			const name = path.name;
			const parentHandle = await getDetails(this.#api, opaqueId);
			handle = await parentHandle.getFileHandle(name, { create: true });
		}

		const writable = await handle.createWritable();
		await writable.write(contents);
		await writable.close();
	}

	/**
	 * Appends a value to a file. If the value is a string, UTF-8 encoding is used.
 	 * @param {string} opaqueId The id of the file.
	 * @param {Uint8Array} contents The contents to append to the file.
	 * @returns {Promise<void>} Resolves when the file is written.
	 * @throws {TypeError} If the file path is not a string.
	 * @throws {Error} If the file cannot be appended to.
	 */
	async append(opaqueId, contents) {
		const handle = /** @type {FastFileDetails} */ (
			await getDetails(this.#api, opaqueId)
		);

		// If there's no existing file, just write the contents
		if (!handle) {
			return this.write(opaqueId, contents);
		}

		// Can't write to a directory
		if (handle.kind !== "file") {
			throw new DirectoryError(`append '${opaqueId}'`);
		}

		const existing = await (await handle.getFile()).arrayBuffer();
		const newValue = new Uint8Array([
			...new Uint8Array(existing),
			...contents,
		]);

		return this.write(opaqueId, newValue);
	}

	/**
	 * Checks if a file exists.
 	 * @param {string} opaqueId The id of the file or directory.
	 * @returns {Promise<boolean>} Resolves with true if the file exists
	 * 	or false if it does not.
	 * @throws {TypeError} If the file path is not a string.
	 */
	async isFile(opaqueId) {
		const handle = await getDetails(this.#api, opaqueId);
		return !!(handle && handle.kind === "file");
	}

	/**
	 * Checks if a directory exists.
 	 * @param {string} opaqueId The id of the file or directory.
	 * @returns {Promise<boolean>} Resolves with true if the directory exists
	 * 	or false if it does not.
	 * @throws {TypeError} If the directory path is not a string.
	 */
	async isDirectory(opaqueId) {
		const handle = await getDetails(this.#api, opaqueId);
		return !!(handle && handle.kind === "directory");
	}

	/**
	 * Creates a directory recursively.
 	 * @param {string} opaqueId The parent directory id.
	 * @returns {Promise<void>} Resolves when the directory is created.
	 */
	async createDirectory(opaqueId) {
		// TODO: Implement this method
	}

	/**
	 * Deletes a file or empty directory.
 	 * @param {string} opaqueId The id of the file or directory.
	 * @returns {Promise<void>} Resolves when the file or directory is deleted.
	 * @throws {TypeError} If the file or directory path is not a string.
	 * @throws {Error} If the file or directory cannot be deleted.
	 * @throws {Error} If the file or directory is not found.
	 */
	async delete(opaqueId) {
		const handle = await getDetails(this.#api, opaqueId);
		const parentHandle = await getDetails(this.#api, opaqueId);

		if (!handle) {
			throw new NotFoundError(`delete '${opaqueId}'`);
		}

		// Non-empty directories must not be deleted
		if (handle.kind === "directory") {
			const entries = handle.values();
			const next = await entries.next();
			if (!next.done) {
				throw new NotEmptyError(`delete '${opaqueId}'`);
			}
		}

		parentHandle.removeEntry(handle.name);
	}

	/**
	 * Deletes a file or directory recursively.
 	 * @param {string} opaqueId The id of the file or directory.
	 * @returns {Promise<void>} Resolves when the file or directory is deleted.
	 * @throws {TypeError} If the file or directory path is not a string.
	 * @throws {Error} If the file or directory cannot be deleted.
	 * @throws {Error} If the file or directory is not found.
	 */
	async deleteAll(opaqueId) {
		const handle = await getDetails(this.#api, opaqueId);

		if (!handle) {
			throw new NotFoundError(`deleteAll '${opaqueId}'`);
		}
	
		await handle.remove({ recursive: true });
		return;
	}

	/**
	 * Returns a list of directory entries for the given path.
 	 * @param {string} opaqueId The id of the file or directory.
	 * @returns {AsyncIterable<FastFileList>} Resolves with the directory entries.
	 */
	async *list(opaqueId) {
		const handle = await getDetails(this.#api, opaqueId);

		if (!handle) {
			return;
		}

		// @ts-ignore -- TS doesn't know about this yet
		for await (const entry of handle.values()) {
			const isDirectory = entry.kind === "directory";
			const isFile = entry.kind === "file";

			yield {
				name: entry.name,
				isDirectory,
				isFile,
				isSymlink: false,
			};
		}
	}

	/**
	 * Returns the size of a file.
 	 * @param {string} opaqueId The id of the file or directory.
	 * @returns {Promise<number|undefined>} Resolves with the size of the file in bytes
	 * 	or undefined if the file doesn't exist.
	 */
	async size(opaqueId) {
		const handle = await getDetails(this.#api, opaqueId);

		if (!handle || handle.kind !== "file") {
			return undefined;
		}

		const fileHandle = /** @type {FastFileDetails} */ (handle);
		const file = await fileHandle.getFile();
		return file.size;
	}

	/**
	 * Returns the last modified date of a file or directory.
	 * This method handles ENOENT errors and returns undefined in that case.
	 * @param {string} opaqueId The id of the file or directory.
	 * @returns {Promise<Date|undefined>} Resolves with the last modified
	 * 	date of the file or directory, or undefined if the file doesn't exist.
	 */
	async lastModified(opaqueId) {
		const handle = await getDetails(this.#api, opaqueId);

		if (!handle) {
			return undefined;
		}

		if (handle.kind === "file") {
			const fileHandle = /** @type {FastFileDetails} */ (handle);
			const file = await fileHandle.getFile();
			return new Date(file.lastModified);
		}

		/*
		 * OPFS doesn't support last modified dates for directories, so we'll
		 * check each entry to see what the most recent last modified date is.
		 */
		let lastModified = new Date(0);

		// @ts-ignore -- TS doesn't know about this yet
		for await (const entry of this.list(opaqueId)) {
			const entryPath = Path.from(opaqueId);
			entryPath.push(entry.name);

			const date = await this.lastModified(entryPath.toString());
			if (date && date > lastModified) {
				lastModified = date;
			}
		}

		/*
		 * Kind of messy -- if the last modified date is the one we set for
		 * default, then we'll return a new Date() instead. This is because
		 * we can't return undefined from this method when the directory is
		 * found, and it also really doesn't matter when the directory is empty.
		 */
		return lastModified.getTime() === 0 ? new Date() : lastModified;
	}

	/**
	 * Copies a file from one location to another.
	 * @param {string} source The id to the file to copy.
	 * @param {string} destination The id to the destination directory.
	 * @returns {Promise<void>} Resolves when the file is copied.
	 */
	async copy(source, destination) {
		const fromHandle = /** @type {FastFileDetails} */ (
			await getDetails(this.#api, source)
		);

		if (!fromHandle) {
			throw new NotFoundError(`copy '${source}' -> '${destination}'`);
		}

		if (fromHandle.kind !== "file") {
			throw new DirectoryError(`copy '${source}' -> '${destination}'`);
		}

		if (await this.isDirectory(destination)) {
			throw new DirectoryError(`copy '${source}' -> '${destination}'`);
		}

		const toHandle = /** @type {FastFileDetails} */ (
			await getDetails(this.#api, destination)
		);
		const file = await fromHandle.getFile();
		const writable = await toHandle.createWritable();
		await writable.write(file);
		await writable.close();
	}

	/**
	 * Copies a file or directory from one location to another.
	 * @param {string} source The id of the file or directory to copy.
	 * @param {string} destination The id of the destination directory.
	 * @returns {Promise<void>} Resolves when the file or directory is copied.
	 * @throws {Error} If the source file or directory does not exist.
	 * @throws {Error} If the destination file or directory is a directory.
	 */
	async copyAll(source, destination) {
		// for files use copy() and exit
		if (await this.isFile(source)) {
			return this.copy(source, destination);
		}

		// if the source isn't a directory then throw an error
		if (!(await this.isDirectory(source))) {
			throw new NotFoundError(`copyAll '${source}' -> '${destination}'`);
		}

		const sourcePath = Path.from(source);
		const destinationPath = Path.from(destination);

		// for directories, create the destination directory and copy each entry
		await this.createDirectory(destination);

		for await (const entry of this.list(source)) {
			destinationPath.push(entry.name);
			sourcePath.push(entry.name);

			if (entry.isDirectory) {
				await this.copyAll(
					sourcePath.toString(),
					destinationPath.toString(),
				);
			} else {
				await this.copy(
					sourcePath.toString(),
					destinationPath.toString(),
				);
			}

			destinationPath.pop();
			sourcePath.pop();
		}
	}

	/**
	 * Moves a file from one location to another
	 * @param {string} source The id of the file to move.
	 * @param {string} destination The id of the destination directory.
	 * @returns {Promise<void>} Resolves when the move is complete.
	 * @throws {TypeError} If the file paths are not strings.
	 * @throws {Error} If the file cannot be moved.
	 */
	async move(source, destination) {
		const handle = await getDetails(this.#api, source);

		if (!handle) {
			throw new NotFoundError(`move '${source}' -> '${destination}'`);
		}

		if (handle.kind !== "file") {
			throw new DirectoryError(`move '${source}' -> '${destination}'`);
		}

		const fileHandle = /** @type {FastFileDetails} */ (handle);
		const destinationPath = Path.from(destination);
		const destinationName = destinationPath.pop();
		const destinationParent = await getDetails(this.#api, destinationPath.toString());

		const handleChromeError = async ex => {
			if (ex.name === "NotAllowedError") {
				await this.copy(source, destination);
				await this.delete(source);
				return;
			}
			throw ex;
		};

		return fileHandle
			.move(destinationParent, destinationName)
			.catch(handleChromeError);
	}

	/**
	 * Moves a file or directory from one location to another.
	 * @param {string} source The id of the file or directory to move.
	 * @param {string} destination The of to the destination directory.
	 * @returns {Promise<void>} Resolves when the file or directory is moved.
	 * @throws {Error} If the source file or directory does not exist.
	 */
	async moveAll(source, destination) {
		const handle = await getDetails(this.#api, source);

		// If the source doesn't exist then throw an error
		if (!handle) {
			throw new NotFoundError(`moveAll '${source}' -> '${destination}'`);
		}

		// For files use move() and exit
		if (handle.kind === "file") {
			return this.move(source, destination);
		}

		const directoryHandle = /** @type {string} */ (handle);
		const destinationPath = Path.from(destination);

		// Chrome doesn't yet support move() on directories
		// @ts-ignore -- TS doesn't know about this yet
		if (directoryHandle.move) {
			const destinationName = destinationPath.pop();
			const destinationParent = await getDetails(this.#api, destinationPath.toString());

			// @ts-ignore -- TS doesn't know about this yet
			return directoryHandle.move(destinationParent, destinationName);
		}

		const sourcePath = Path.from(source);

		// for directories, create the destination directory and move each entry
		await this.createDirectory(destination);

		for await (const entry of this.list(source)) {
			destinationPath.push(entry.name);
			sourcePath.push(entry.name);

			if (entry.isDirectory) {
				await this.moveAll(
					sourcePath.toString(),
					destinationPath.toString(),
				);
			} else {
				await this.move(
					sourcePath.toString(),
					destinationPath.toString(),
				);
			}

			destinationPath.pop();
			sourcePath.pop();
		}

		await this.delete(source);
	}
}

/**
 * A class representing a file system utility library.
 * @implements {HfsImpl}
 */
export class FastHfs extends Hfs {
	/**
	 * Creates a new instance.
	 * @param {object} options The options for the instance.
	 * @param {string} options.apiKey The API key for the account.
	 * @param {string} options.workspaceId The workspace to target.
	 */
	constructor({ apiKey, workspaceId }) {
		super({ impl: new FastHfsImpl({ apiKey, workspaceId }) });
	}
}
