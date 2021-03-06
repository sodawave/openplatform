const Fs = require('fs');
require('dbms').init(CONF.database);

FUNC.apps = {};
FUNC.users = {};
FUNC.sessions = {};
FUNC.common = {};
FUNC.settings = {};
FUNC.notifications = {};
FUNC.files = {};
FUNC.badges = {};
FUNC.configs = {};

// ====================================
// Users
// ====================================

FUNC.users.set = function(user, fields, callback, app) {

	// @user {Object/Object Array}
	// @fields {String Array} Optional, changed fields
	// @callback {Function} Optional
	// @app {Object} Optional, app instance (can contain an app when the count of notifications/badges is updated)

	var obj;
	var builder;

	if (user.id) {

		if (fields && fields.length) {
			obj = {};
			for (var i = 0; i < fields.length; i++)
				obj[fields[i]] = user[fields[i]];
		} else
			obj = CLONE(user);

		if (app) {
			delete obj.apps;

			// Is notification or badge?
			// Performs MongoDB "$inc"

			if (fields.indexOf('countbadges') === -1)
				obj['+apps.' + app.id + '.countnotifications'] = 1;
			else
				obj['+apps.' + app.id + '.countbadges'] = 1;

		}

		builder = DBMS().modify('users', obj).where('_id', user.id);

	} else {
		obj = CLONE(user);
		obj._id = obj.id = UID();
		builder = DBMS().insert('users', obj);
	}

	callback && builder.callback(() => callback(null, user.id));
};

FUNC.users.get = function(id, callback) {
	if (id[0] === '@') // Find by reference
		DBMS().read('users').where('reference', id.substring(1)).callback(callback);
	else // Finds a user by ID
		DBMS().read('users').where('_id', id).callback(callback);
};

FUNC.users.query = function(filter, callback) {
	var builder = DBMS().listing('users');

	if (typeof(filter.id) === 'string')
		filter.id = filter.id.split(',');

	filter.id && builder.in(filter.id);
	filter.appid && builder.contains('apps.' + filter.appid);
	filter.q && builder.search('search', filter.q.toSearch());
	filter.group && builder.where('groups', filter.group);
	filter.role && builder.where('roles', filter.role);
	filter.ou && builder.where('ougroups', filter.ou);
	filter.locality && builder.where('locality', filter.locality);

	if (filter.directory) {
		// Is number?
		if ((/^\d+$/g).test(filter.directory))
			builder.where('directoryid', +filter.directory);
		else
			builder.where('directory', filter.directory);
	}

	filter.company && builder.where('company', filter.company);
	filter.gender && builder.where('gender', filter.gender);
	filter.statusid && builder.where('statusid', filter.statusid);
	filter.customer && builder.where('customer', true);
	filter.reference && builder.where('reference', filter.reference);
	filter.directory && builder.where('directory', filter.directory);

	filter.modified && builder.or(function() {
		filter.modified = NOW.add('-' + filter.modified);
		builder.where('dateupdated', '>', filter.modified);
		builder.where('datecreated', '>', filter.modified);
	});

	filter.online && builder.where('online', true);
	filter.logged && builder.where('datelogged', '>', NOW.add('-' + filter.modified));

	builder.paginate(filter.page, filter.limit, 1000);
	builder.callback(callback);
};

FUNC.users.rem = function(id, callback) {
	var db = DBMS();
	db.read('users').where('_id', id).callback(callback);
	db.remove('notifications').where('userid', id);
	db.remove('users').where('_id', id);
};

FUNC.users.login = function(login, password, callback) {
	DBMS().read('users').where('login', login).callback(function(err, response) {
		if (response == null || password.sha256() !== response.password)
			callback();
		else
			callback(null, response);
	});
};

FUNC.users.logout = function(user, controller) {
	controller.redirect('/');
};

FUNC.users.password = function(login, callback) {
	DBMS().read('users').where('login', login).callback(callback);
};

FUNC.users.online = function(user, is, callback) {
	DBMS().modify('users', { online: is }).where('_id', user.id).first();
	user.online = is;
	callback && callback(null);
};

// Codelist of from users
FUNC.users.meta = function(callback, directory) {

	var meta = {};
	var db = DBMS();

	// Companies
	db.query('users', function(collection, next) {

		var filter = [];

		directory && filter.push({ $match: { directory: directory }});
		filter.push({ $group: { _id: '$company', count: { $sum: 1 }}});

		collection.aggregate(filter, function(err, response) {
			if (err) {
				next(err);
			} else {
				response.toArray(function(err, response) {
					var obj = [];
					for (var i = 0; i < response.length; i++) {
						var item = response[i];
						if (item._id)
							obj.push({ id: item._id, name: item._id, count: item.count });
					}
					obj.quicksort('name');
					meta.companies = obj;
					next(err);
				});
			}
		});
	});

	// Customers
	db.query('users', function(collection, next) {

		var filter = [];

		if (directory)
			filter.push({ $match: { directory: directory, customer: true }});
		else
			filter.push({ $match: { customer: true }});

		filter.push({ $group: { _id: '$company', count: { $sum: 1 }}});

		collection.aggregate(filter, function(err, response) {
			if (err) {
				next(err);
			} else {
				response.toArray(function(err, response) {
					var obj = [];
					for (var i = 0; i < response.length; i++) {
						var item = response[i];
						if (item._id)
							obj.push({ id: item._id, name: item._id, count: item.count });
					}
					obj.quicksort('name');
					meta.customers = obj;
					next(err);
				});
			}
		});
	});

	// Locality
	db.query('users', function(collection, next) {

		var filter = [];

		directory && filter.push({ $match: { directory: directory }});
		filter.push({ $group: { _id: '$locality', count: { $sum: 1 }}});

		collection.aggregate(filter, function(err, response) {
			if (err) {
				next(err);
			} else {
				response.toArray(function(err, response) {
					var obj = [];
					for (var i = 0; i < response.length; i++) {
						var item = response[i];
						if (item._id)
							obj.push({ id: item._id, name: item._id, count: item.count });
					}
					obj.quicksort('name');
					meta.localities = obj;
					next(err);
				});
			}
		});
	});

	// Directory
	db.query('users', function(collection, next) {

		var filter = [];

		directory && filter.push({ $match: { directory: directory }});
		filter.push({ $group: { _id: '$directory', count: { $sum: 1 }}});

		collection.aggregate(filter, function(err, response) {
			if (err) {
				next(err);
			} else {
				response.toArray(function(err, response) {
					var obj = [];
					for (var i = 0; i < response.length; i++) {
						var item = response[i];
						if (item._id)
							obj.push({ id: item._id.crc32(true), name: item._id, count: item.count });
					}
					obj.quicksort('name');
					meta.directories = obj;
					next(err);
				});
			}
		});
	});

	// Roles
	db.query('users', function(collection, next) {

		var filter = [];

		directory && filter.push({ $match: { directory: directory }});
		filter.push({ $unwind: '$roles' });
		filter.push({ $group: { _id: '$roles', count: { $sum: 1 }}});

		collection.aggregate(filter, function(err, response) {
			if (err) {
				next(err);
			} else {
				response.toArray(function(err, response) {
					var obj = [];
					for (var i = 0; i < response.length; i++) {
						var item = response[i];
						if (item._id)
							obj.push({ id: item._id, name: item._id, count: item.count });
					}
					obj.quicksort('name');
					meta.roles = obj;
					next(err);
				});
			}
		});
	});

	// Groups
	db.query('users', function(collection, next) {

		var filter = [];

		directory && filter.push({ $match: { directory: directory }});
		filter.push({ $unwind: '$groups' });
		filter.push({ $group: { _id: '$groups', count: { $sum: 1 }}});

		collection.aggregate(filter, function(err, response) {
			if (err) {
				next(err);
			} else {
				response.toArray(function(err, response) {
					var obj = [];
					for (var i = 0; i < response.length; i++) {
						var item = response[i];
						if (item._id)
							obj.push({ id: item._id, name: item._id, count: item.count });
					}
					obj.quicksort('name');
					meta.groups = obj;
					next(err);
				});
			}
		});
	});

	// Organization unit
	db.query('users', function(collection, next) {

		var filter = [];

		directory && filter.push({ $match: { directory: directory }});
		filter.push({ $unwind: '$ougroups' });
		filter.push({ $group: { _id: '$ougroups', count: { $sum: 1 }}});

		collection.aggregate(filter, function(err, response) {
			if (err) {
				next(err);
			} else {
				response.toArray(function(err, response) {
					var obj = [];
					for (var i = 0; i < response.length; i++) {
						var item = response[i];
						if (item._id) {
							item._id = item._id.replace(/\//g, ' / ');
							obj.push({ id: item._id, name: item._id, count: item.count });
						}
					}
					meta.ou = obj;
					next(err);
				});
			}
		});
	});

	if (directory) {
		db.callback(function() {
			G.metadirectories[directory] = meta;
			callback && callback(null, meta);
		});
	} else {

		db.callback(function() {

			G.metadirectories = {};
			G.meta = meta;

			if (meta.directories && meta.directories.length) {
				// Recursive read meta directories
				meta.directories.wait(function(item, next) {
					FUNC.users.meta(next, item.name);
				}, () => callback && callback(null, meta));
			} else
				callback && callback(null, meta);
		});
	}

};

// Assigns app according to the model (filter)
FUNC.users.assign = function(model, callback) {

	// { "appid": '', roles: [] }

	var db = DBMS();
	var upd = {};

	upd['apps.' + model.appid + '.roles'] = model.roles;

	var builder = db.modify('users', upd);

	if (model.company)
		builder.where('company', model.company);

	if (model.locality)
		builder.where('locality', model.locality);

	if (model.directory)
		builder.where('directory', model.directory);

	if (model.group)
		builder.where('groups', model.group);

	if (model.ou)
		builder.where('ougroups', model.ou);

	if (model.role)
		builder.where('roles', model.role);

	if (model.gender)
		builder.where('gender', model.gender);

	if (model.customer)
		builder.where('customer', model.customer);

	if (model.sa)
		builder.where('sa', model.sa);

	builder.callback(function(id, count) {
		// Notifies users about change
		FUNC.emit('users.refresh');
		callback(null, count);
	});
};

// ====================================
// Apps
// ====================================

FUNC.apps.get = function(id, callback) {
	// Finds a user by ID
	DBMS().read('apps').where('_id', id).callback(callback);
};

FUNC.apps.set = function(app, fields, callback) {

	var obj;
	var builder;

	if (app.id) {
		if (fields && fields.length) {
			obj = {};
			for (var i = 0; i < fields.length; i++)
				obj[fields[i]] = app[fields[i]];
		} else
			obj = CLONE(app);
		builder = DBMS().modify('apps', obj).where('_id', app.id);
	} else {
		obj = CLONE(app);
		obj._id = obj.id = UID();
		builder = DBMS().insert('apps', obj);
	}

	callback && builder.callback(() => callback(null, app.id));
};

FUNC.apps.rem = function(id, callback) {
	var db = DBMS();
	db.read('apps').where('_id', id).callback(callback);
	db.remove('apps').where('_id', id);
	db.remove('notifications').where('appid', id);
	db.remove('configs').where('appid', id);
	db.query('users', function(collection, next) {
		var filter = {};
		var upd = { $unset: {} };
		filter['apps.' + id] = { '$exists': true };
		upd.$unset['apps.' + id] = '';
		collection.updateMany(filter, upd, next);
	});
};

FUNC.apps.query = function(filter, callback) {

	// filter.take
	// filter.skip
	// filter.q
	// filter.id {String Array}

	if (typeof(filter.id) === 'string')
		filter.id = filter.id.split(',');

	var builder = DBMS().listing('apps');
	builder.paginate(filter.page, filter.limit, 1000);
	filter.id && builder.in('_id', filter.id);
	// filter.directory && builder.where('directory', filter.directory);
	filter.q && builder.search('search', filter.q.toSearch());
	builder.callback(callback);
};

// Internal service for refreshing meta info of all registered applications
// This functionality can do some service in special cases
ON('service', function(counter) {
	if (counter % 10 !== 0)
		return;
	refresh_apps(0);
});

function refresh_apps(page) {
	var builder = DBMS().listing('apps');
	builder.paginate(page, 100);
	builder.callback(function(err, apps) {
		apps.items.wait(function(item, next) {
			OP.refresh(item, function(err, item) {
				if (item) {
					FUNC.apps.set(item, ['hostname', 'online', 'version', 'name', 'description', 'author', 'icon', 'frame', 'email', 'roles', 'groups', 'width', 'height', 'resize', 'type', 'screenshots', 'origin', 'daterefreshed'], function() {
						next();
						FUNC.emit('apps.sync', item.id);
					});
				} else
					next();
			});
		}, function() {
			if (apps.items.length)
				refresh_apps(apps.page + 1);
			else
				FUNC.emit('apps.refresh');
		});
	});
}

// ====================================
// Sessions
// ====================================

FUNC.sessions.set = function(key, value, expire, callback) {

	if (typeof(expire) === 'function') {
		callback = expire;
		expire = null;
	}

	F.cache.set(key, value, expire || '2 hours');
	callback && callback(null);
};

FUNC.sessions.get = function(key, callback) {
	callback(null, F.cache.get2(key));
};

FUNC.sessions.rem = function(key, callback) {
	F.cache.remove(key);
	callback(null);
};

// ====================================
// Settings
// ====================================

FUNC.settings.get = function(callback) {
	DBMS().read('common').where('_id', 'settings').callback(function(err, response) {
		callback(err, response || {});
	});
};

FUNC.settings.set = function(data, callback) {
	data._id = 'settings';
	DBMS().modify('common', data, true).where('_id', 'settings');
	callback && callback(null);
};

// ====================================
// Badges
// ====================================

FUNC.badges.rem = function(userid, appid, callback) {
	var obj = {};
	obj['apps.' + appid + '.countbadges'] = 0;
	DBMS().modify('users', obj).where('_id', userid).first().callback(callback);
};

// ====================================
// Notifications
// ====================================

FUNC.notifications.add = function(data, callback) {
	// data.userid
	// data.appid
	// data.type
	// data.body
	// data.data
	// data.title
	// data.ip
	// data.datecreated

	DBMS().insert('notifications', data).callback(callback);
};

FUNC.notifications.rem = function(userid, callback) {
	var db = DBMS();
	db.remove('notifications').where('userid', userid);
	db.read('users').where('_id', userid).fields('apps').data(function(response) {

		var apps = Object.keys(response.apps);
		var obj = {};
		var is = false;

		for (var i = 0; i < apps.length; i++) {
			var app = response.apps[apps[i]];
			if (app && app.countnotifications) {
				is = true;
				obj['apps.' + apps[i] + '.countnotifications'] = 0;
			}
		}

		if (is) {
			obj.countnotifications = 0;
			DBMS().modify('users', obj).where('_id', userid);
		}
	});
	callback && callback();
};

FUNC.notifications.get = function(userid, callback) {
	DBMS().find('notifications').where('userid', userid).callback(callback);
};

// ====================================
// Configs
// ====================================

FUNC.configs.get = function(userid, appid, callback) {
	DBMS().read('configs').where('userid', userid).where('appid', appid).callback(function(err, doc) {
		callback(err, doc ? doc.body : null);
	});
};

FUNC.configs.set = function(userid, appid, data, callback) {
	DBMS().modify('configs', { body: data, datelogged: NOW }, true).where('userid', userid).where('appid', appid).insert(function(doc) {
		doc.userid = userid;
		doc.appid = appid;
		doc.datecreated = NOW;
	}).first().callback(callback);
};

FUNC.configs.rem = function(userid, appid, callback) {
	DBMS().remove('configs').where('userid', userid).where('appid', appid).first().callback(callback);
};

// ====================================
// Files
// ====================================

// "backgrounds" are stored in /public/backgrounds/{id}.ext
// "photos" are stored in /public/photos/{id}.jpg
// if you want to use own file handler just create a custom FILE() route

FUNC.files.uploadphoto = function(base64, callback) {
	var id = NOW.format('yyyyMMddHHmm') + '_' + U.GUID(8) + '.jpg';
	var filename = F.path.temp(id);
	base64.base64ToFile(filename, function() {
		DBMS().blob('photos').write(Fs.createReadStream(filename), id, function(err, id) {
			callback(err, id ? (id + '.jpg') : null);
			Fs.unlink(filename, NOOP);
		});
	});
};

FUNC.files.uploadbackground = function(httpfile, callback) {
	DBMS().blob('backgrounds').write(httpfile.stream(), httpfile.filename, function(err, id) {
		callback(err, id ? (id + '.' + U.getExtension(httpfile.filename)) : null);
	});
};

FUNC.files.removephoto = function(id) {
	var path = 'photos/' + id;
	F.touch('/' + path);
	DBMS().blob('photos').remove(id, NOOP);
};

FUNC.files.removebackground = function(id) {
	var path = 'backgrounds/' + id;
	F.touch('/' + path);
	DBMS().blob('backgrounds').remove(id, NOOP);
};

FILE('/photos/*.jpg', function(req, res) {
	var id = req.split[1].replace('.jpg', '');
	DBMS().blob('photos').read(id, function(err, stream) {
		if (err)
			res.throw404(err);
		else
			res.stream('image/jpeg', stream);
	});
});

FILE('/backgrounds/*.jpg', function(req, res) {
	var id = req.split[1].replace('.jpg', '');
	DBMS().blob('backgrounds').read(id, function(err, stream) {
		if (err)
			res.throw404(err);
		else
			res.stream('image/jpeg', stream);
	});
});

// ====================================
// Common
// ====================================

FUNC.init = function(callback) {
	FUNC.users.meta();
	callback && callback();
	refresh_apps();
};

FUNC.emit = function(type, a, b, c, d, e) {
	EMIT(type, a, b, c, d, e);
};

FUNC.on = function(type, callback) {
	ON(type, callback);
};

FUNC.error = function(place, err) {
	F.error(err, null, place);
};

FUNC.logger = LOGGER;