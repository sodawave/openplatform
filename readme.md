# OpenPlatform v1.0.0

__Login__:
- user: 123456
- password: 123456

---

## Documentation

1. How does the OpenPlatform work?
2. How does the application work in the OpenPlatform?
3. Server-Side communication between the OpenPlatform and Application
4. Client-Side communication between the OpenPlatform and Application
5. Widgets

### How does the OpenPlatform work?

The platform is a simple application which can manage 3rd applications and users + roles. Each application is executed in the HTML `iframe` but in the OpenPlatform's context. 3rd applications (if have privileges) can read users, applications or can create notifications or can communicate with other applications via service worker. The platform offers two ways for communication:

- server-side
- client-side via small [openplatform.js](https://github.com/totaljs/openplatform/blob/master/public/v1/openplatform.js) library

![OpenPlatform workbench](https://www.totaljs.com/img/openplatform/openplatform-auth.png)

---

### How does the application work in the OpenPlatform?

Each 3rd application must contain `openplatform.json` file which it describes the whole application, its roles, icon and widgets. The full URL address to `openplatform.json` is the application identificator in the OpenPlatform. The platform downloads the content of the file `openplatform.json` each 5 minutes.

```javascript
{
    "name": "TestApp",
    "version": "1.0.0",
    "icon": "http://openapp.totaljs.com/icon.png",

    // Author of the application
    "author": "Peter Širka",

    // Suport email
    "email": "petersirka@gmail.com",

    // Optional. The description sees only the super user of the OpenPlatform.
    "description": "Some text for the super user.",

    // URL which is opened when the user click on the application's icon
    "url": "http://openapp.totaljs.com",

    // Optional. URL for obtaining session.
    "sessionurl": "http://openapp.totaljs.com/openplatform/",

    // Optional. Can be empty.
    "roles": ["create", "read", "update"],

    // Optional.
    "widgets": [
        {
            // Widget's name
            "name": "Chart.js",

            // Widget generator
            "url": "http://openapp.totaljs.com/widgets/chartjs/",

            // Optional. When the user click on the widget then the OpenPlatform
            // redirects the iFrame to this URL address. Default: application "url"
            "redirect": "",

            // Optional. Widget's background color. Default: white
            "background": "white",

            // Optional. Widget's font color. Default: silver
            "color": "silver",

            // Optional. Size of widget "1" = 400x250, "2" = 600x250, "3" = 800x250.
            // Default: 1
            "size": 1,

            // Optional. Refresh interval, default 15000 (15 seconds). A minimal value
            // can be 15000.
            "interval": 15000
        }
    ],

    // Optional. Can contain IP addresses. The OpenPlatform checks origin IP when
    // the platform receives a server-side request from the application. It's simple
    // prevention for hijacking.
    "origin": ['10.77.50.11']
}
```

### Server-Side communication between the OpenPlatform and Application

Each server-side request has to contain additional headers into the OpenPlatform:

- `x-openplatform-id` __(important)___ the full URL address to the application's `openplatform.json`
- `x-openplatform-user` __(important)___ the user identificator (with except obtaining a session)
- `x-openplatform-secret` __(optional)__ additional security element (must know the OpenPlatform and the Application)

#### Session `sessionurl` request

```html
https://www.yourapplication.com/openplatform/?openplatform=http%3A%2F%2Fopenplatform.totaljs.com%2Fsession%2F%3Ftoken%3D14mp1e1r3fs9k5lrkqggewg9a1hq71~-1556735938~-684557733~1569270833
```

- you have to create a request to URL address in `openplatform` argument

__Request__:

```html
GET http://openplatform.totaljs.com/session/?token=14mp1e1r3fs9k5lrkqggewg9a1hq71~-1556735938~-684557733~1569270833
x-openplatform-id: http://openapp.totaljs.com/openplatform.json
x-openplatform-secret: app-secret
```

__Response__:

```javascript
{
    // User ID for future requests: `x-openplatform-user`
    "id": "16061919190001xis1",
    "alias": "Peter Širka",
    "firstname": "Peter",
    "lastname": "Širka",
    "photo": "http://openplatform.totaljs.com/photos/petersirka_gmail_com.jpg",
    "email": "petersirka@gmail.com",
    "phone": "",
    "online": true,
    "blocked": false,
    "group": "Developers",
    "superadmin": true,
    "notifications": true,
    "dateupdated": "2016-06-17T19:08:32.328Z",
    "datecreated": "2016-06-16T12:03:22.434Z",
    "sounds": true,
    "language": "sk",

    // Application's settings
    "settings": "",

    // Application's roles
    "roles": [
        "create",
        "read",
        "update"
    ],

    // OpenPlatform's information
    "openplatform": {
        "version": "0.0.1",
        "name": "OpenPlatform",
        "url": "http://openplatform.totaljs.com",
        "author": "Peter Širka"
    }
}
```


#### Application `url` request

```html
https://www.yourapplication.com/?openplatform=http%3A%2F%2Fopenplatform.totaljs.com%2Fsession%2F%3Ftoken%3D14mp1e1r3fs9k5lrkqggewg9a1hq71~-1556735938~-684557733~1569270833
```


