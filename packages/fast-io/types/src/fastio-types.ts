/**
 * @fileoverview The types file for the FastIO hfs package.
 * @author MediaFire
 */

//------------------------------------------------------------------------------
// FastFileDetails
//------------------------------------------------------------------------------

export interface FastFileDetails {
	/** The id of the file. */
	id: boolean;
	/** The type of the file. */
	type: 'file' | 'folder';
	/** The name of the file. */
	name: string;
	/** The parent directory of the file. */
	parent: object;
	/** The size of the file in bytes. */
	size: number;
	/** The hash of the file. */
	hash: string;
	/** The type of hash used. */
	hash_type: string;
	/** The version of the file. */
	version: string;
	/** The MIME type of the file. */
	mimetype: string;
	/** The user who uploaded the file. */
	user: string;
	/** The users who have access to the file. */
	users: string[];
	/** The date the file was created. */
	created: string;
	/** The date the file was last updated. */
	updated: string;
	/** True if the file is restricted, false if not. */
	restricted: boolean;
	/** True if the file is subject to DMCA, false if not. */
	dmca: boolean;
	/** True if the file contains a virus, false if not. */
	virus: boolean;
	/** True if the file is locked, false if not. */
	locked: boolean;
	/** The key-value pairs associated with the file. */
	keyvalue: object[];
	/** The users the file is shared with. */
	share: string[];
}

//------------------------------------------------------------------------------
// FastFileList
//------------------------------------------------------------------------------

export interface FastFileList {
	/** True if the list was retrieved successfully. */
	result: boolean;
	/** The number of records retrieved during the operation. */
	results: number;
	/** The list of files. */
	list: FastFileDetails[];
}

//------------------------------------------------------------------------------
// FastFileDetails
//------------------------------------------------------------------------------

export interface FastFileDetails {
	/** The id of the file. */
	id: boolean;
	/** The type of the file. */
	type: 'file' | 'folder';
	/** The name of the file. */
	name: string;
	/** The size of the file in bytes. */
	size: number;
	/** The MIME type of the file. */
	mimetype: string;
}
