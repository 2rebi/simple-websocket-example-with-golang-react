import * as React from "react"
import {
  ChakraProvider,
  Box,
  Text,
  Link,
  VStack,
  Grid,
  theme, Input, HStack, Button, Spacer, Tag, Divider,
} from "@chakra-ui/react"
import {ChangeEvent, FormEvent, useCallback, useRef, useState} from "react";

type Message = {
  id: string;
  name: string;
  message: string;
  align: "left"| "right";
  at: Date;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [socketURL, setSocketURL] = useState("");
  const { isOpen, open, send } = useWebsocket(socketURL);

  const onMessage = useCallback((ev: MessageEvent) => {
    const msg = JSON.parse(ev.data) as Message;
    setMessages(prevState => {
      return [...prevState, {
        ...msg,
        align: "left",
        at: new Date(),
      }]
    });
    console.log();
  }, []);

  const connect = useCallback(() => {
    open(onMessage);
  }, [open, onMessage]);

  const onSend = useCallback((value: string) => {
    send(value);
    setMessages(prevState => {
      return [...prevState, {
        id: `ME-${Date.now()}`,
        name: "ME",
        message: value,
        align: "right",
        at: new Date(),
      }]
    });
  }, [send]);

  const needSocketURL = !isOpen;

  return <ChakraProvider theme={theme}>
    <Box textAlign="center" fontSize="xl">
      <Grid minH="100vh">
        <VStack p="16px" maxH="100vh">
          <Box boxShadow="2xl" w="100%" maxW="800px" h="100%" borderRadius="2xl">
            <VStack h="100%" w="100%">
              {
                needSocketURL ?
                    <InputConnection
                        value={socketURL}
                        onChange={setSocketURL}
                        onOpen={connect}
                    /> : <InputMessage
                        messages={messages}
                        onSend={onSend}
                    />
              }
            </VStack>
          </Box>
        </VStack>
      </Grid>
    </Box>
  </ChakraProvider>;
}

type InputConnectionProps = {
  value: string;
  onChange: (value: string) => void;
  onOpen: () => void;
};

function InputConnection({ value, onChange, onOpen }: InputConnectionProps) {
  const connect = useCallback((ev: FormEvent<HTMLDivElement>) => {
    ev.preventDefault();
    onOpen();
  }, [onOpen]);

  const onChangeValue = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
    onChange(ev.target.value);
  }, [onChange]);

  return <>
    <Spacer />
    <HStack as="form" w="100%" padding="16px" onSubmit={connect}>
      <Input
          type="text"
          name="serverURL"
          placeholder="주소"
          size="lg"
          value={value}
          onChange={onChangeValue}
      />
      <Button size="lg" type="submit">접속</Button>
    </HStack>
    <Spacer />
  </>;
}

type InputMessageProps = {
  messages: Message[];
  onSend: (value: string) => void;
};

function InputMessage({ messages, onSend }: InputMessageProps) {

  const onSubmit = useCallback((ev: FormEvent<HTMLDivElement>) => {
    ev.preventDefault();
    const t = ev.target as HTMLFormElement;
    onSend(t.message.value);
    t.message.value = "";
  }, [onSend]);

  return <>
    <VStack w="100%" h="100%" overflow="hidden">
      <VStack w="100%" h="100%" overflowY="scroll">
        <Spacer />
        {
          messages.map(value => <VStack
              key={value.id}
              px="16px"
              w="100%"
              alignItems={value.align === "left" ? "start" : "end"}
              spacing={0}
              py="8px"
          >
            <Tag size="md">
              {value.name}
            </Tag>
            <Box boxSize="4px" />
            <Text fontSize="md" fontWeight="bold">{value.message}</Text>
            <Text fontSize="sm" color="gray">{value.at.toLocaleString()}</Text>
          </VStack>)
        }

      </VStack>
    </VStack>
    <HStack as="form" w="100%" padding="16px" onSubmit={onSubmit} flexShrink={0}>
      <Input
          type="text"
          name="message"
          placeholder="...메세지"
          size="lg"
      />
      <Button size="lg" type="submit">전송</Button>
    </HStack>
  </>;
}

function useWebsocket(url: string | URL, protocols?: string | string[]) {
  const [isOpen, setOpen] = useState(false);
  const wsRef = useRef<WebSocket>();

  const onClose = useCallback((ws: WebSocket) => {
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;
    ws.onopen = null;
    setOpen(false);
  }, []);

  const open = useCallback((onmessage: (ev: MessageEvent) => void, onerror?: (ev: Event) => void) => {
    const ws = new WebSocket(url, protocols);

    ws.onclose = (_: CloseEvent) => onClose(ws);
    ws.onerror = (ev: Event) => {
      if (onerror !== undefined) onerror(ev);
    };
    ws.onmessage = onmessage;
    ws.onopen = (_: Event) => setOpen(true);
    wsRef.current = ws;
  }, [onClose, url, protocols]);

  const close = useCallback((code?: number, reason?: string) => {
    const ws = wsRef.current;
    if (ws === undefined) return;
    ws.close(code, reason);
    wsRef.current = undefined;
    onClose(ws);
  }, [onClose]);

  const send = useCallback((value: string) => {
    const ws = wsRef.current;
    if (ws === undefined) return;
    ws.send(value);
  }, []);

  return {
    isOpen,
    open,
    close,
    send,
  };

}