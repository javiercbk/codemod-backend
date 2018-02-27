const express = require('express');
const path = require('path');
const dir = require('node-dir');
const Promise = require('bluebird');
const codemod = require('../lib/codemod');
const fs = require('fs');

const router = express.Router();

const routerFactory = (projectDir) => {
  const filterFolders = name =>
    name.indexOf('lms-spa/node_modules') === -1 &&
    name.indexOf('lms-spa/frontend') === -1 &&
    name.indexOf('lms-spa/.git') === -1 &&
    name.indexOf('lms-spa/.nyc_output') === -1 &&
    name.indexOf('lms-spa/.vscode') === -1 &&
    name.indexOf('lms-spa/uploads') === -1 &&
    name.indexOf('lms-spa/logs') === -1 &&
    name.indexOf('lms-spa/coverage') === -1 &&
    name.indexOf('lms-spa/backups') === -1 &&
    name.indexOf('lms-spa/eop') === -1 &&
    name.indexOf('lms-spa/key') === -1 &&
    name.indexOf('lms-spa/.gitignore') === -1;

  const filterFiles = name =>
    name.lastIndexOf('.js') === name.length - 3 && name.indexOf('.DS_Store') === -1;

  const fileListFactory = (folder, func, transform, filter) => {
    const fullPath = path.join(projectDir, folder);
    return new Promise((resolve, reject) => {
      func(fullPath, (err, files) => {
        if (err) {
          console.log('fullPath', fullPath);
          reject(err);
        } else {
          let arr = files;
          if (filter) {
            arr = files.filter(filter);
          }
          resolve(arr.map(transform));
        }
      });
    });
  };

  const listFilesInFolder = folder =>
    fileListFactory(
      folder,
      dir.files,
      (f) => {
        let strippedFolder = path.dirname(f).substring(projectDir.length);
        if (!strippedFolder) {
          strippedFolder = '/';
        }
        return { fileType: 'file', name: path.basename(f), folder: strippedFolder };
      },
      n => filterFolders(n) && filterFiles(n),
    );

  const lsFolder = (folder) => {
    const filesFunc = (f, callback) => {
      dir.files(f, 'file', callback, { recursive: false });
    };
    const folderFunc = (f, callback) => {
      dir.files(f, 'dir', callback, { recursive: false });
    };
    return Promise.all([
      fileListFactory(
        folder,
        folderFunc,
        (f) => {
          const parsedPath = path.parse(f);
          let strippedFolder = parsedPath.dir.substring(projectDir.length);
          if (!strippedFolder) {
            strippedFolder = '/';
          } else {
            strippedFolder = `${strippedFolder}/`;
          }
          return { fileType: 'folder', name: parsedPath.base, folder: strippedFolder };
        },
        filterFolders,
      ),
      fileListFactory(
        folder,
        filesFunc,
        (f) => {
          const parsedPath = path.parse(f);
          let strippedFolder = parsedPath.dir.substring(projectDir.length);
          if (!strippedFolder) {
            strippedFolder = '/';
          }
          return { fileType: 'file', name: path.basename(f), folder: strippedFolder };
        },
        n => filterFolders(n) && filterFiles(n),
      ),
    ]).then(result => result[0].concat(result[1]));
  };

  const sendFiles = (res, files) => {
    res.status(200).json({ status: { code: 200, error: false }, data: { files } });
  };

  /* GET home page. */
  router.get('/all', (req, res, next) => {
    listFilesInFolder('')
      .then((allFiles) => {
        sendFiles(res, allFiles);
      })
      .catch((err) => {
        next(err);
      });
  });

  router.get(/\/codemod\/folder\/.*/, (req, res, next) => {
    // remove the /codemod/folder/
    const fullPath = req.path.substring(15);
    // FIXME dangerous AF...very easy to hack it
    fs.readFile(path.join(projectDir, fullPath), (err, data) => {
      if (err) {
        next(err);
      } else {
        let modifiedSrc;
        let error = null;
        try {
          modifiedSrc = codemod(data.toString());
        } catch (e) {
          error = e;
        }
        if (error) {
          next(error);
        } else {
          res.setHeader('Content-type', 'text/plain');
          res.status(200).send(modifiedSrc);
        }
      }
    });
  });

  router.get(/\/folder\/.*/, (req, res, next) => {
    // remove the /folder
    const folder = req.path.substring(7);
    if (folder.indexOf('.js') === folder.length - 3) {
      res.setHeader('Content-type', 'text/plain');
      const fileFullPath = path.join(projectDir, folder);
      res.status(200).sendFile(fileFullPath);
    } else {
      lsFolder(folder)
        .then((files) => {
          sendFiles(res, files);
        })
        .catch((err) => {
          next(err);
        });
    }
  });

  return router;
};

module.exports = routerFactory;
