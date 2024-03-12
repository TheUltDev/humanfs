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

/**
 * Finds a file or directory in the FastIO workspace.
 * @param {string} workspaceId The workspace to search.
 * @param {string} opaqueId The path to the file or directory to find.
 * @param {object} [options] The options for finding.
 * @param {boolean} [options.returnParent] True if the parent directory should be
 *  returned instead of the file or directory.
 * @param {boolean} [options.create] True if the file or directory should be
 *  created if it doesn't exist.
 * @param {"file"|"directory"} [options.kind] The kind of file or directory to find.
 * @returns {Promise<FastFileDetails|undefined>} The file or directory found.
 */
async function getDetails(
	workspaceId,
	opaqueId,
	{ returnParent = false, create = false, kind } = {},
) {
	// Special case: "root" targets the workspace root directory
	if (opaqueId === "root") {
		return workspaceId;
	}

	const path = Path.from(opaqueId);
	const steps = [...path];

	if (returnParent) {
		steps.pop();
	}

	let handle = workspaceId;
	let name = steps.shift();

	while (handle && name) {
		// `name` must represent a directory
		if (steps.length > 0) {
			try {
				handle = await handle.getDirectoryHandle(name, { create });
			} catch {
				return undefined;
			}
		} else {
			if (!kind) {
				try {
					return await handle.getDirectoryHandle(name, { create });
				} catch {
					try {
						return await handle.getFileHandle(name, { create });
					} catch {
						return undefined;
					}
				}
			}

			if (kind === "directory") {
				try {
					return await handle.getDirectoryHandle(name, { create });
				} catch {
					return undefined;
				}
			}

			if (kind === "file") {
				try {
					return await handle.getFileHandle(name, { create });
				} catch {
					return undefined;
				}
			}
		}

		name = steps.shift();
	}

	return undefined;
}

/**
 * Reads a file from the specified root.
 * @param {string} root The root directory to search.
 * @param {string} filePath The path to the file to read.
 * @param {"text"|"arrayBuffer"} dataType The type of data to read.
 * @returns {Promise<string|ArrayBuffer|undefined>} The contents of the file or
 *   undefined if the file does not exist.
 */
async function readFile(root, filePath, dataType) {
	const handle = await getDetails(root, filePath);

	if (!handle || handle.kind !== "file") {
		return undefined;
	}

	const fileHandle = /** @type {FileSystemFileHandle} */ (handle);
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
 * A class representing the Origin Private File System implementation of Hfs.
 * @implements {HfsImpl}
 */
export class FastHfsImpl {
	/**
	 * The workspace to target.
	 * @type {string}
	 */
	#workspaceId;

	/**
	 * Creates a new instance.
	 * @param {object} options The options for the instance.
	 * @param {string} options.workspaceId The workspace to target.
	 * @throws {TypeError} If options.workspaceId is not provided.
	 */
	constructor({ workspaceId }) {
		if (!workspaceId) {
			throw new TypeError("options.workspaceId is required");
		}

		this.#workspaceId = workspaceId;
	}

	/**
	 * Reads a file and returns the contents as an Uint8Array.
	 * @param {string} filePath The path to the file to read.
	 * @returns {Promise<Uint8Array|undefined>} A promise that resolves with the contents
	 *    of the file or undefined if the file does not exist.
	 * @throws {Error} If the file cannot be read.
	 * @throws {TypeError} If the file path is not a string.
	 */
	async bytes(filePath) {
		const buffer = /** @type {ArrayBuffer|undefined} */ (
			await readFile(this.#workspaceId, filePath, "arrayBuffer")
		);
		return buffer ? new Uint8Array(buffer) : undefined;
	}

	/**
	 * Writes a value to a file. If the value is a string, UTF-8 encoding is used.
	 * @param {string} filePath The path to the file to write.
	 * @param {Uint8Array} contents The contents to write to the
	 *   file.
	 * @returns {Promise<void>} A promise that resolves when the file is
	 *  written.
	 * @throws {TypeError} If the file path is not a string.
	 * @throws {Error} If the file cannot be written.
	 */
	async write(filePath, contents) {
		let handle = /** @type {FileSystemFileHandle} */ (
			await getDetails(this.#workspaceId, filePath)
		);

		if (!handle) {
			const path = Path.from(filePath);
			const name = path.name;
			const parentHandle =
				/** @type {string} */ (
					await getDetails(this.#workspaceId, filePath, {
						create: true,
						kind: "directory",
						returnParent: true,
					})
				) ?? this.#workspaceId;
			handle = await parentHandle.getFileHandle(name, { create: true });
		}

		const writable = await handle.createWritable();
		await writable.write(contents);
		await writable.close();
	}

	/**
	 * Appends a value to a file. If the value is a string, UTF-8 encoding is used.
	 * @param {string} filePath The path to the file to append to.
	 * @param {Uint8Array} contents The contents to append to the
	 *  file.
	 * @returns {Promise<void>} A promise that resolves when the file is
	 * written.
	 * @throws {TypeError} If the file path is not a string.
	 * @throws {Error} If the file cannot be appended to.
	 */
	async append(filePath, contents) {
		const handle = /** @type {FileSystemFileHandle} */ (
			await getDetails(this.#workspaceId, filePath)
		);

		// if there's no existing file, just write the contents
		if (!handle) {
			return this.write(filePath, contents);
		}

		// can't write to a directory
		if (handle.kind !== "file") {
			throw new DirectoryError(`append '${filePath}'`);
		}

		const existing = await (await handle.getFile()).arrayBuffer();
		const newValue = new Uint8Array([
			...new Uint8Array(existing),
			...contents,
		]);

		return this.write(filePath, newValue);
	}

	/**
	 * Checks if a file exists.
	 * @param {string} filePath The path to the file to check.
	 * @returns {Promise<boolean>} A promise that resolves with true if the
	 *    file exists or false if it does not.
	 * @throws {TypeError} If the file path is not a string.
	 */
	async isFile(filePath) {
		const handle = await getDetails(this.#workspaceId, filePath);
		return !!(handle && handle.kind === "file");
	}

	/**
	 * Checks if a directory exists.
	 * @param {string} dirPath The path to the directory to check.
	 * @returns {Promise<boolean>} A promise that resolves with true if the
	 *    directory exists or false if it does not.
	 * @throws {TypeError} If the directory path is not a string.
	 */
	async isDirectory(dirPath) {
		const handle = await getDetails(this.#workspaceId, dirPath);
		return !!(handle && handle.kind === "directory");
	}

	/**
	 * Creates a directory recursively.
	 * @param {string} dirPath The path to the directory to create.
	 * @returns {Promise<void>} A promise that resolves when the directory is
	 *   created.
	 */
	async createDirectory(dirPath) {
		let handle = this.#workspaceId;
		const path = Path.from(dirPath);

		for (const name of path) {
			handle = await handle.getDirectoryHandle(name, { create: true });
		}
	}

	/**
	 * Deletes a file or empty directory.
	 * @param {string} opaqueId The path to the file or directory to
	 *   delete.
	 * @returns {Promise<void>} A promise that resolves when the file or
	 *   directory is deleted.
	 * @throws {TypeError} If the file or directory path is not a string.
	 * @throws {Error} If the file or directory cannot be deleted.
	 * @throws {Error} If the file or directory is not found.
	 */
	async delete(opaqueId) {
		const handle = await getDetails(this.#workspaceId, opaqueId);
		const parentHandle =
			/** @type {string} */ (
				await getDetails(this.#workspaceId, opaqueId, {
					returnParent: true,
				})
			) ?? this.#workspaceId;

		if (!handle) {
			throw new NotFoundError(`delete '${opaqueId}'`);
		}

		// nonempty directories must not be deleted
		if (handle.kind === "directory") {
			// @ts-ignore -- TS doesn't know about this yet
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
	 * @param {string} opaqueId The path to the file or directory to
	 *   delete.
	 * @returns {Promise<void>} A promise that resolves when the file or
	 *   directory is deleted.
	 * @throws {TypeError} If the file or directory path is not a string.
	 * @throws {Error} If the file or directory cannot be deleted.
	 * @throws {Error} If the file or directory is not found.
	 */
	async deleteAll(opaqueId) {
		const handle = await getDetails(this.#workspaceId, opaqueId);

		if (!handle) {
			throw new NotFoundError(`deleteAll '${opaqueId}'`);
		}

		/*
		 * Note: For some reason, Chromium is not respecting the
		 * `recursive` option on `string.removeEntry()`.
		 * I've been unable to come up with a minimal repro case to demonstrate.
		 * Need to investigate further.
		 * https://bugs.chromium.org/p/chromium/issues/detail?id=1521975
		 */

		// @ts-ignore -- only supported by Chrome right now
		if (handle.remove) {
			// @ts-ignore -- only supported by Chrome right now
			await handle.remove({ recursive: true });
			return;
		}

		const parentHandle =
			/** @type {string} */ (
				await getDetails(this.#workspaceId, opaqueId, {
					returnParent: true,
				})
			) ?? this.#workspaceId;

		if (!handle) {
			throw new NotFoundError(`deleteAll '${opaqueId}'`);
		}
		parentHandle.removeEntry(handle.name, { recursive: true });
	}

	/**
	 * Returns a list of directory entries for the given path.
	 * @param {string} dirPath The path to the directory to read.
	 * @returns {AsyncIterable<FastFileList>} A promise that resolves with the
	 *   directory entries.
	 */
	async *list(dirPath) {
		const handle = /** @type {string} */ (
			await getDetails(this.#workspaceId, dirPath)
		);

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
	 * @param {string} filePath The path to the file to read.
	 * @returns {Promise<number|undefined>} A promise that resolves with the size of the
	 *  file in bytes or undefined if the file doesn't exist.
	 */
	async size(filePath) {
		const handle = await getDetails(this.#workspaceId, filePath);

		if (!handle || handle.kind !== "file") {
			return undefined;
		}

		const fileHandle = /** @type {FileSystemFileHandle} */ (handle);
		const file = await fileHandle.getFile();
		return file.size;
	}

	/**
	 * Returns the last modified date of a file or directory. This method handles ENOENT errors
	 * and returns undefined in that case.
	 * @param {string} opaqueId The path to the file to read.
	 * @returns {Promise<Date|undefined>} A promise that resolves with the last modified
	 * date of the file or directory, or undefined if the file doesn't exist.
	 */
	async lastModified(opaqueId) {
		const handle = await getDetails(this.#workspaceId, opaqueId);

		if (!handle) {
			return undefined;
		}

		if (handle.kind === "file") {
			const fileHandle = /** @type {FileSystemFileHandle} */ (handle);
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
	 * @param {string} source The path to the file to copy.
	 * @param {string} destination The path to the destination file.
	 * @returns {Promise<void>} A promise that resolves when the file is copied.
	 */
	async copy(source, destination) {
		const fromHandle = /** @type {FileSystemFileHandle } */ (
			await getDetails(this.#workspaceId, source)
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

		const toHandle = /** @type {FileSystemFileHandle } */ (
			await getDetails(this.#workspaceId, destination, {
				create: true,
				kind: "file",
			})
		);
		const file = await fromHandle.getFile();
		const writable = await toHandle.createWritable();
		await writable.write(file);
		await writable.close();
	}

	/**
	 * Copies a file or directory from one location to another.
	 * @param {string} source The path to the file or directory to copy.
	 * @param {string} destination The path to copy the file or directory to.
	 * @returns {Promise<void>} A promise that resolves when the file or directory is
	 * copied.
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
	 * Moves a file from the source path to the destination path.
	 * @param {string} source The location of the file to move.
	 * @param {string} destination The destination of the file to move.
	 * @returns {Promise<void>} A promise that resolves when the move is complete.
	 * @throws {TypeError} If the file paths are not strings.
	 * @throws {Error} If the file cannot be moved.
	 */
	async move(source, destination) {
		const handle = await getDetails(this.#workspaceId, source);

		if (!handle) {
			throw new NotFoundError(`move '${source}' -> '${destination}'`);
		}

		if (handle.kind !== "file") {
			throw new DirectoryError(`move '${source}' -> '${destination}'`);
		}

		const fileHandle = /** @type {FileSystemFileHandle} */ (handle);
		const destinationPath = Path.from(destination);
		const destinationName = destinationPath.pop();
		const destinationParent = await getDetails(
			this.#workspaceId,
			destinationPath.toString(),
			{ create: true, kind: "directory" },
		);

		const handleChromeError = async ex => {
			if (ex.name === "NotAllowedError") {
				await this.copy(source, destination);
				await this.delete(source);
				return;
			}
			throw ex;
		};

		return (
			fileHandle
				// @ts-ignore -- TS doesn't know about this yet
				.move(destinationParent, destinationName)
				.catch(handleChromeError)
		);
	}

	/**
	 * Moves a file or directory from one location to another.
	 * @param {string} source The path to the file or directory to move.
	 * @param {string} destination The path to move the file or directory to.
	 * @returns {Promise<void>} A promise that resolves when the file or directory is
	 * moved.
	 * @throws {Error} If the source file or directory does not exist.
	 */
	async moveAll(source, destination) {
		const handle = await getDetails(this.#workspaceId, source);

		// if the source doesn't exist then throw an error
		if (!handle) {
			throw new NotFoundError(`moveAll '${source}' -> '${destination}'`);
		}

		// for files use move() and exit
		if (handle.kind === "file") {
			return this.move(source, destination);
		}

		const directoryHandle = /** @type {string} */ (
			handle
		);
		const destinationPath = Path.from(destination);

		// Chrome doesn't yet support move() on directories
		// @ts-ignore -- TS doesn't know about this yet
		if (directoryHandle.move) {
			const destinationName = destinationPath.pop();
			const destinationParent = await getDetails(
				this.#workspaceId,
				destinationPath.toString(),
				{ create: true, kind: "directory" },
			);

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
	 * @param {string} options.workspaceId The workspace to target.
	 */
	constructor({ workspaceId }) {
		super({ impl: new FastHfsImpl({ workspaceId }) });
	}
}

export const hfs = new FastHfs({
	workspaceId: '4696910076313161000'
});
