#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const mkdirp = require("mkdirp");

const mkdir = promisify(mkdirp);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

const buildStats = require("../plugin/build-stats");
const TEMPLATE = require("../plugin/template-types");
const warn = require("../plugin/warn");
const JSON_VERSION = require("./version");

const argv = require("yargs")
  .strict()
  .option("extra-style-path", {
    describe: "Extra override css file path",
    string: true
  })
  .option("filename", {
    describe: "Output file name",
    string: true,
    default: "./stats.html"
  })
  .option("title", {
    describe: "Output file title",
    string: true,
    default: "RollUp Visualizer"
  })
  .option("template", {
    describe: "Template type",
    string: true,
    choices: TEMPLATE,
    default: "treemap"
  })
  .help().argv;

const listOfFiles = argv._;

const run = async (title, template, extraStylePath, filename, files) => {
  if (files.length === 0) {
    throw new Error("Empty file list");
  }

  const fileContents = await Promise.all(
    files.map(async file => {
      const textContent = await readFile(file, { encoding: "utf-8" });
      const jsonContent = JSON.parse(textContent);
      return [file, jsonContent];
    })
  );

  const tree = {
    name: "root",
    children: []
  };
  const nodes = Object.create(null);
  let links = [];

  let sizes = null;

  for (const [file, fileContent] of fileContents) {
    if (fileContent.version !== JSON_VERSION) {
      warn(
        `Version in ${file} is not supported (${fileContent.version}). Current version ${JSON_VERSION}. Skipping...`
      );
      continue;
    }

    if (fileContent.tree.name === "root") {
      tree.children = tree.children.concat(fileContent.tree.children);
    } else {
      tree.children.push(fileContent.tree);
    }

    Object.assign(nodes, fileContent.nodes);

    links = links.concat(fileContent.links);

    if (sizes == null || sizes.length > fileContent.sizes.length) {
      sizes = fileContent.sizes;
    }
  }

  const data = { version: JSON_VERSION, tree, links, nodes, sizes };

  const fileContent = await buildStats(
    title,
    data,
    template,
    extraStylePath,
    {}
  );

  await mkdir(path.dirname(filename));
  await writeFile(filename, fileContent);
};

run(
  argv.title,
  argv.template,
  argv.extraStylePath,
  argv.filename,
  listOfFiles
).catch(err => {
  warn(err.message);
  process.exit(1);
});
