// utils/indexedDB.js

const DB_PREFIX = 'log_';

// 生成唯一的数据库名称
const generateUniqueFileName = async (fileName) => {
    const existingFileNames = await getDatabaseNames();
    let uniqueFileName = fileName;
    let counter = 1;

    while (existingFileNames.includes(uniqueFileName)) {
        uniqueFileName = `${fileName}_${counter}`;
        counter += 1;
    }

    return uniqueFileName;
};

// 保存日志到 IndexedDB
export const saveLogToIndexedDB = async (fileName, logs) => {
    const uniqueFileName = await generateUniqueFileName(fileName);
    const dbName = `${DB_PREFIX}${uniqueFileName}`;
    const dbRequest = indexedDB.open(dbName, 1);

    dbRequest.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('logs')) {
            db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
        }
    };

    dbRequest.onsuccess = async (event) => {
        const db = event.target.result;
        const transaction = db.transaction('logs', 'readwrite');
        const store = transaction.objectStore('logs');
        logs.forEach(log => store.add(log));
    };

    dbRequest.onerror = (event) => {
        console.error('Error opening database:', event.target.errorCode);
    };
};

// 从 IndexedDB 中获取日志
export const fetchLogsFromIndexedDB = async (fileName) => {
    const dbName = `${DB_PREFIX}${fileName}`;
    return new Promise((resolve, reject) => {
        const dbRequest = indexedDB.open(dbName, 1);

        dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction('logs', 'readonly');
            const store = transaction.objectStore('logs');
            const getAllRequest = store.getAll();

            getAllRequest.onsuccess = () => {
                resolve(getAllRequest.result);
            };

            getAllRequest.onerror = (event) => {
                console.error('Error fetching logs:', event.target.errorCode);
                reject(event.target.errorCode);
            };
        };

        dbRequest.onerror = (event) => {
            console.error('Error opening database:', event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
};

// 获取数据库名称
export const getDatabaseNames = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.databases ? indexedDB.databases() : null;
        console.log('IndexedDB.databases():', request); // Debugging line

        if (!request) {
            reject('IndexedDB.databases() is not supported');
            return;
        }

        request.then(
            (dbs) => {
                console.log('Databases found:', dbs); // Debugging line
                const fileNames = dbs
                    .filter(db => db.name.startsWith(DB_PREFIX))
                    .map(db => db.name.replace(DB_PREFIX, ""));
                console.log('Filtered fileNames:', fileNames); // Debugging line
                resolve(fileNames);
            },
            (error) => {
                console.error('Error getting database names:', error);
                reject(error);
            }
        );
    });
};

// 删除 IndexedDB 数据库
export const deleteDatabase = (fileName) => {
    const dbName = `${DB_PREFIX}${fileName}`;
    const request = indexedDB.deleteDatabase(dbName);

    request.onsuccess = () => {
        console.log(`Database ${dbName} deleted successfully`); // Debugging line
    };

    request.onerror = (event) => {
        console.error(`Error deleting database ${dbName}:`, event.target.errorCode);
    };
};
