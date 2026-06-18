# Real-Time Chat Application

## Overview

A full-stack real-time messaging application built using Node.js, Express.js, Socket.IO, and SQLite. The platform supports user authentication, private messaging, group chats, and persistent message storage.

## Features

* User signup and login with bcrypt password hashing
* Real-time one-to-one messaging
* Group chat functionality
* Persistent chat history using SQLite
* Instant message delivery using Socket.IO
* Responsive chat interface

## Tech Stack

* Frontend: HTML, CSS, JavaScript
* Backend: Node.js, Express.js
* Real-Time Communication: Socket.IO
* Database: SQLite
* Security: bcrypt

## Architecture

* HTTP APIs for authentication and data retrieval
* WebSocket communication for real-time messaging
* SQLite database for storing users, messages, groups, and memberships
* Socket.IO rooms for group communication

## Key Concepts Demonstrated

* Client-Server Architecture
* REST APIs
* WebSockets
* Real-Time Systems
* Relational Database Design
* Authentication & Password Hashing
* Event-Driven Programming
* Application-Level Multicast

## Future Improvements

* JWT Authentication
* Online/Offline Status
* Typing Indicators
* Read Receipts
* Cloud Deployment
* PostgreSQL Migration
