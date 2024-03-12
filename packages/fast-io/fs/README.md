# `fastio-fs`

The humanfs bindings for the [Fast.io](https://fast.io) collaborative cloud storage provider.

> If you find this useful, please consider supporting the [humanfs](https://github.com/humanwhocodes/humanfs) project by [Nicholas C. Zakas](https://humanwhocodes.com) with a [donation](https://humanwhocodes.com/donate) or [nominate him](https://stars.github.com/nominate/) for a GitHub Star.

## Installation

```sh
npm i fast-fs
```

## Usage

1. Import the `FastHfs` constructor:

```js
import { FastHfs } from "fastio-fs";
```
2. Create the instance using your [API Key](https://docs.fast.io/reference/post-create-api-key) and [Workspace ID](https://docs.fast.io/reference/organization-details-copy):

```js
const hfs = new FastHfs({
	apiKey: "yffaenajzny66mrdiuk6s6dvk6ef2gq7ia72",
	workspaceId: "4696910076313161000"
});
```

3. Now you can use the [Storage API](https://docs.fast.io/reference/storage-endpoint-details) methods:

```js
// --------------------------------------------------------------------
// FILES
// --------------------------------------------------------------------

// Read from a text file
const text = await hfs.text("file.txt");

// Read from a JSON file
const json = await hfs.json("file.json");

// Read raw bytes from a text file
const bytes = await hfs.bytes("file.txt");

// Write text to a file
await hfs.write("file.txt", "Hello world!");

// Write bytes to a file
await hfs.write("file.txt", new TextEncoder().encode("Hello world!"));

// Append text to a file
await hfs.append("file.txt", "Hello world!");

// Append bytes to a file
await hfs.append("file.txt", new TextEncoder().encode("Hello world!"));

// Does the file exist?
const found = await hfs.isFile("file.txt");

// How big is the file?
const size = await hfs.size("file.txt");

// When was the file modified?
const mtime = await hfs.lastModified("file.txt");

// Copy a file from one location to another
await hfs.copy("file.txt", "file-copy.txt");

// Move a file from one location to another
await hfs.move("file.txt", "renamed.txt");

// Delete a file
await hfs.delete("file.txt");

// --------------------------------------------------------------------
// DIRECTORIES
// --------------------------------------------------------------------

// Create a directory
await hfs.createDirectory("dir");

// Create a directory recursively
await hfs.createDirectory("dir/subdir");

// Does the directory exist?
const dirFound = await hfs.isDirectory("dir");

// Copy the entire directory
hfs.copyAll("from-dir", "to-dir");

// Move the entire directory
hfs.moveAll("from-dir", "to-dir");

// Delete a directory
await hfs.delete("dir");

// Delete a non-empty directory
await hfs.deleteAll("dir");
```

## License

Apache 2.0
