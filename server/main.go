package main

import (
	"errors"
	"fmt"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"golang.org/x/net/websocket"
	"io"
	"sync"
	"time"
)

var tableLock sync.Mutex
var table = make(map[*websocket.Conn]bool)

func addUser(ws *websocket.Conn) {
	tableLock.Lock()
	defer tableLock.Unlock()
	table[ws] = true
}

func sayHello(ws *websocket.Conn) error {
	return websocket.
		Message.
		Send(
			ws,
			fmt.Sprintf(
				`{"id": "SERVER-%d","name": "SERVER","message": "Hello Client!"}`,
				time.Now().UnixMilli(),
			),
		)
}

func delUser(ws *websocket.Conn) {
	tableLock.Lock()
	defer tableLock.Unlock()
	delete(table, ws)
}

func broadcastUser(c echo.Context, me *websocket.Conn, message string) {
	var wg sync.WaitGroup
	wg.Add(len(table) - 1)
	for ws := range table {
		if ws == me {
			continue
		}

		target := ws
		go func() {
			defer wg.Done()
			err := websocket.
				Message.
				Send(
					target,
					fmt.Sprintf(
						`{"id": "%s-%d","name": "%s","message": "%s"}`,
						time.Now().UnixMilli(),
						target.Request().RemoteAddr,
						target.Request().RemoteAddr,
						message,
					),
				)

			if err != nil {
				c.Logger().Error(err)
			}
		}()
	}

	wg.Wait()
}

func hello(c echo.Context) error {
	websocket.Handler(func(ws *websocket.Conn) {
		defer func() {
			delUser(ws)
			err := ws.Close()
			if err != nil {
				c.Logger().Error(err)
			}
		}()

		addUser(ws)
		err := sayHello(ws)
		if err != nil {
			c.Logger().Error(err)
		}

		var msg string
		for {
			err = websocket.Message.Receive(ws, &msg)
			switch {
			case err == nil:
				broadcastUser(c, ws, msg)
			case errors.Is(err, io.EOF):
				return
			default:
				c.Logger().Error(err)
			}
		}
	}).ServeHTTP(c.Response(), c.Request())
	return nil
}

func main() {
	e := echo.New()
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.GET("/ws", hello)
	e.Logger.Fatal(e.Start(":1323"))
}
