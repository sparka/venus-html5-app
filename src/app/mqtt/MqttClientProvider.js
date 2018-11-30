import React, { Component } from "react"
import { MqttClientContext } from "../index.js"

import * as mqtt from "mqtt"
import { getMessageJson, parseTopic } from "../../service/util"
export const STATUS = {
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  RECONNECTING: "reconnecting"
}

class MqttClientProvider extends Component {
  state = {
    client: null,
    error: null,
    status: STATUS.CONNECTING,
    hasFailedToConnect: false,
    messages: {}
  }

  componentDidMount() {
    const client = mqtt.connect(`mqtt://${this.props.host}:${this.props.port}`)
    this.setState({ client })

    client.stream.on("error", error => {
      this.setState({ error })
    })

    client.on("error", error => {
      this.setState({ error })
    })

    client.on("connect", () => {
      this.setState({ status: STATUS.CONNECTED })
    })

    client.on("disconnect", () => {
      this.setState({ status: STATUS.DISCONNECTED })
    })

    client.on("reconnect", () => {
      const previousStatus = this.state.status
      this.setState({ status: STATUS.RECONNECTING })

      if (previousStatus === STATUS.CONNECTING && this.state.error) {
        client.end()
        this.setState({ hasFailedToConnect: true })
      }
    })

    client.on("message", (topic, message) => {
      console.log(`Message received: ${topic} - ${message.toString()}`)

      this.setState({
        messages: {
          ...this.state.messages,
          [topic]: getMessageJson(message)
        }
      })
    })
  }

  getMessagesByTopics = topicList => {
    let initialValues = topicList.reduce((obj, key) => {
      obj[key] = { value: null }
      return obj
    }, {})

    return Object.keys(this.state.messages)
      .filter(topic => topicList.includes(topic))
      .reduce((obj, key) => {
        obj[key] = this.state.messages[key]
        return obj
      }, initialValues)
  }

  getMessagesByWildcard = wildcard => {
    const wildcardParts = parseTopic(wildcard)
    let values = Object.keys(this.state.messages)
      .filter(topic => {
        const topicParts = parseTopic(topic)
        const matchesWildcard =
          (topicParts.dbusPath === wildcardParts.dbusPath || wildcardParts.dbusPath === "+") &&
          (topicParts.portalId === wildcardParts.portalId || wildcardParts.portalId === "+") &&
          (topicParts.serviceType === wildcardParts.serviceType || wildcardParts.serviceType === "+") &&
          (topicParts.deviceInstance === wildcardParts.deviceInstance || wildcardParts.deviceInstance === "+")

        return matchesWildcard
      })
      .reduce((obj, key) => {
        obj[key] = this.state.messages[key]
        return obj
      }, {})

    return values
  }

  render() {
    return (
      <MqttClientContext.Provider
        value={{
          client: this.state.client,
          messages: this.state.messages,
          getMessagesByTopics: this.getMessagesByTopics,
          getMessagesByWildcard: this.getMessagesByWildcard
        }}
      >
        {this.props.children(this.state.status, this.state.error)}
      </MqttClientContext.Provider>
    )
  }
}

export default MqttClientProvider