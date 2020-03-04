# Простой чат на websocket и Tarantool

Рассмотрим пример простого чата с использованием WebSocket API и модуля `websocket` для Tarantool.

## Установка зависимостей

Для раздачи статики нам понадобится `http-server`, установить его можно так

```bash
npm install http-server -g
```

Также нужно установить модуль `websocket` для Tarantool
```bash
tarantoolctl rocks install https://github.com/tarantool/websocket/raw/master/websocket-scm-1.rockspec
```

## Клиент

В html нам нужна форма `<form>` для отправки данных и `div` для отображения сообщений

```html
<!-- index.html -->
<!-- форма сообщений -->
<form name="publish">
    <input type="text" name="message">
    <input type="submit" value="Отправить">
</form>
  
  <!-- div с сообщениями -->
  <div id="messages"></div>

<script type="text/javascript" src="socket.js"></script>
```

От JavaScript мы хотим 3 вещи:

* Открыть соединение.
* При отправке формы пользователем – вызвать `socket.send(message)` для сообщения.
* При получении входящего сообщения – добавить его в `div#messages`.

Вот код

```js
// socket.js
let socket = new WebSocket("ws://0.0.0.0:8081");

// отправка сообщения из формы
document.forms.publish.onsubmit = function() {
  let outgoingMessage = this.message.value;

  socket.send(outgoingMessage);
  return false;
};

// получение сообщения - отобразить данные в div#messages
socket.onmessage = function(event) {
  let message = JSON.parse(event.data);

  let messageElem = document.createElement('div');
  messageElem.textContent = message.data + ' | from: ' + message.author;
  
  document.getElementById('messages').prepend(messageElem);
}
```

Поместим файлы `index.hmtl` и `socket.js` в папку `static`

## Сервер

Серверный алгоритм действий будет таким:

* Создать `ws_peers = {}` – набор клиентов.
* Для каждого принятого веб-сокета – добавить его в набор `table.insert(ws_peers, id, ws_peer)`
* Когда сообщение получено: перебрать клиентов `ws_peers` и отправить его всем.
* Когда подключение закрыто: `ws_peers[id] = nil`.

```lua
-- server.lua
#!/usr/bin/env tarantool

local ws = require('websocket')
local json = require('json')
local ws_peers = {}

ws.server('ws://0.0.0.0:8081', function (ws_peer) -- функция обработчик нового соединения 
    -- fd - файловый дескриптор
    local id = ws_peer.peer:fd() 
    -- сохраняем соединение в таблицу
    table.insert(ws_peers, id, ws_peer) 

    -- обработчик соединения 
    while true do
        -- чтение сообщения от клиента
        local message, err = ws_peer:read()
        if not message or message.opcode == nil then
            break
        end

        -- отправка полученного сообщения всем клиентам
        for _, ws_peer in pairs(ws_peers) do
            ws_peer:write(json.encode({author = 'User '..id, data = message.data})) 
        end
    end

    -- удаление из таблицы после отключения
    ws_peers[id] = nil
end)

return {
    -- функция отправки сообщения всем клиентам из консоли
    push = function (message)
        for _, ws_peer in pairs(ws_peers) do
            ws_peer:write(json.encode({author = "ADMIN", data = message})) 
        end
    end
}
```

Вызовем `box.cfg` и изменем пароль пользователю `admin`, чтобы предоставить возможность подключаться к серверу и вызывать фунцкию `push` для отправки в чат сообщений от администратора.

```lua
-- main.lua
wsserver = require('server')

box.cfg{listen = 3301}
box.schema.user.passwd(os.getenv('PASSWORD') or "")
```

## Запуск

Чтобы запустить сервер раздающий статику нужно выполнить следующую команду

```bash
http-server static/
```

Для запуска websocket сервера на Tarantool

```bash
tarantool main.lua
```

Теперь откройте в браузере несколько вкладок `localhost:8080`, можно начать отправку сообщений в чате - сообщение отправленное из одной вкладки появится в других.

Также можно отправлять в чат сообщения от администратора, для этого нужно подключиться к серверу

```bash
tarantoolctl connect admin:@localhost:3301
```

и выполнить следующую команду
```lua
wssocket.push('This message is from admin')
```