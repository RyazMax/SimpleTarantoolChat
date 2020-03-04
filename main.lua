wsserver = require('server')

box.cfg{listen = 3301}
box.schema.user.passwd(os.getenv('PASSWORD') or "")