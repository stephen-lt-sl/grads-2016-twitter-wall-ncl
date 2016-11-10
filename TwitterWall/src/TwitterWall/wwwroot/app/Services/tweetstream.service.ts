import { Injectable } from "@angular/core";
import { Http, Response } from "@angular/http";
import { Subject } from "rxjs/Subject";
import { Tweet } from "../Models/tweet";
import { Queue } from "../Models/queue";
import { Router, ActivatedRoute, Params } from "@angular/router";

import "rxjs/add/operator/toPromise";

declare var $: any;

@Injectable()
export class TweetStream {
    private conn: any;
    private tweetsQueue: Tweet[] = [];
    private activeTweets: Tweet[] = [];
    private queueChanged = new Subject<Tweet[]>();
    public queueEvent$ = this.queueChanged.asObservable();
    private activeQueueChanged = new Subject<Tweet[]>();
    public activeQueueEvent$ = this.activeQueueChanged.asObservable();

    private deleteFromActiveQueue = new Subject<Tweet>();
    public deleteFromActiveQueueEvent$ = this.deleteFromActiveQueue.asObservable();

    private tracks = new Subject<any[]>();
    public tracksReceived$ = this.tracks.asObservable();

    private users = new Subject<any[]>();
    private priorityUsers = [];
    public usersReceived$ = this.users.asObservable();

    private errorMessage = new Subject<string>();
    public errorMessageReceived$ = this.errorMessage.asObservable();

    private bannedUsers = new Subject<any[]>();
    public bannedUsersReceived$ = this.bannedUsers.asObservable();

    private init = new Subject<boolean>();
    public initialisationChanged$ = this.init.asObservable();
    private initialised: boolean = false;

    private streamEvent: { Id: number, Name: string };
    private eventChange = new Subject<{ Id: number, Name: string }>();
    public eventChanged$ = this.eventChange.asObservable();

    private streamStatus = new Subject<string>();
    public streamStatusChanged$ = this.streamStatus.asObservable();

    constructor(private http: Http) {
    }

    private initialise(): void {
        this.tweetsQueue = [];
        this.activeTweets = [];
        this.conn = $.connection.twitterHub;
        this.conn.client.receiveTweet = (tweet: Tweet, action: string) => {
            if (action === "ADD") {
                this.addActiveTweet(tweet);
            }
            else if (action === "REMOVE") {
                this.removeActiveTweet(tweet);
            }
        };

        this.conn.client.receiveTracks = (tracks) => {
            this.tracks.next(tracks);
        };

        this.conn.client.receiveUsers = (users) => {
            this.users.next(users);
            this.priorityUsers = users;
        };

        this.conn.client.receiveBannedUsers = (bannedUsers) => {
            this.bannedUsers.next(bannedUsers);
        };

        this.conn.client.streamStatusChanged = (status) => {
            this.streamStatus.next(status);
        };

        this.conn.client.tweetChanged = (newTweet: Tweet) => {
            let success = this.activeTweets.some((tweet, i) => {
                if (tweet.Id === newTweet.Id) {
                    this.activeTweets[i] = newTweet;
                    return true;
                }
                return false;
            });
            if (success) {
                this.activeQueueChanged.next(this.activeTweets);
            }
        };

        this.conn.client.tweetRemoved = (id: number) => {
            let tweetToDelete = null;
            let success = this.activeTweets.some((tweet, i) => {
                if (tweet.Id === id) {
                    tweetToDelete = tweet;
                    return true;
                }
                return false;
            });
            if (success) {
                this.removeActiveTweet(tweetToDelete);
            }
        };

        this.conn.client.invalidUser = (errMessage: string) => {
            this.errorMessage.next(errMessage);
        };

        this.conn.client.userBanned = (users: any) => {
            for (const tweet of this.activeTweets) {
                if (tweet.Handle === users[users.length - 1].Handle) this.removeActiveTweet(tweet);
            }
            for (const tweet of this.tweetsQueue) {
                if (tweet.Handle === users[users.length - 1].Handle) this.removeTweet(tweet);
            }
            this.bannedUsers.next(users);
        };

        $.connection.hub.start().done(() => {
            this.init.next(true);
            this.initialised = true;
        });
    }

    stopHubConnection(): void {
        $.connection.hub.stop();
        this.initialised = false;
    }

    setEvent(event: string): void {
        this.stopHubConnection();
        this.http.get("api/events?name=" + event).toPromise().then((res) => {
            if (res.status === 200) {
                const responseJson = JSON.parse((res as any)._body);
                // If there is an element in response, subscribe to a group
                if (responseJson.length > 0) {
                    this.initialise();

                    let event = responseJson[0];
                    this.streamEvent = event;
                    this.eventChange.next(event);

                    if (this.initialised) {
                        this.conn.server.joinGroup(event.Name);
                    }
                    else {
                        this.initialisationChanged$.subscribe((init) => {
                            if (init) {
                                this.conn.server.joinGroup(event.Name);
                            }
                        });
                    }
                    this.getLatestTweets().then((tweets) => {
                        this.activeTweets = tweets;
                        this.activeQueueChanged.next(this.activeTweets);
                    });
                }
            }
        });
    }

    getLatestTweets(): Promise<any[]> {
        return this.http.get("api/tweets?eventName=" + this.streamEvent.Name).toPromise().then((res) => {
            return JSON.parse((res as any)._body);
        });
    }

    getQueue(): Tweet[] {
        return this.tweetsQueue;
    }

    getActiveTweets(): Tweet[] {
        return this.activeTweets;
    }

    addActiveTweet(tweet: Tweet): boolean {
        if (tweet) {
            this.activeTweets.push(tweet);
            this.activeQueueChanged.next(this.activeTweets);
            return true;
        }
        return false;
    }

    removeActiveTweet(tweet: Tweet): boolean {
        let result = this.activeTweets.some((elem, i) => {
            if (tweet.Id === elem.Id) {
                this.deleteFromActiveQueue.next(this.activeTweets[i]);
                this.activeTweets.splice(i, 1);
                this.activeQueueChanged.next(this.activeTweets);
                return true;
            }
            return false;
        });
        return result;
    }

    popNextTweet(): Tweet {
        let tweet = this.tweetsQueue.shift();

        if (tweet) {
            this.queueChanged.next(this.tweetsQueue);
        }

        return tweet;
    }

    addTweet(tweet: Tweet): void {
        let priority = this.priorityUsers.some((el, index) => {
            return el.Value === tweet.Handle;
        }
        );
        priority ? this.tweetsQueue.unshift(tweet) : this.tweetsQueue.push(tweet);
        this.queueChanged.next(this.tweetsQueue);
    }

    removeTweet(tweet: Tweet): void {
        let index = this.tweetsQueue.indexOf(tweet);
        if (index !== -1) {
            this.tweetsQueue.splice(index, 1);
            this.queueChanged.next(this.tweetsQueue);
        }
    }

    addTrack(keyword: string): void {
        if (keyword.length < 60) {
            this.conn.server.addTrack(keyword, this.streamEvent.Name);
        }
    }

    getTracks(): void {
        if (this.streamEvent) {
            this.conn.server.getTracks(this.streamEvent.Name);
        }
    }

    followUser(handle: string): void {
        this.conn.server.followUser(handle, this.streamEvent.Name);
    }

    getPriorityUsers(): void {
        this.conn.server.getPriorityUsers(this.streamEvent.Name);
    }

    getBannedUsers(): void {
        this.conn.server.getBannedUsers(this.streamEvent.Name);
    }

    removeTrack(trackId: number): void {
        this.conn.server.removeTrack(trackId, this.streamEvent.Name);
    }

    removePriorityUser(userId: number): void {
        this.conn.server.removePriorityUser(userId, this.streamEvent.Name);
    }

    restartStream(): void {
        this.conn.server.restartStream(this.streamEvent.Name);
    }

    isInitialised(): boolean {
        return this.initialised;
    }

    toggleSticky(tweetId: number): void {
        this.conn.server.toggleSticky(tweetId, this.streamEvent.Name);
    }

    setTweetImageVisibility(tweetIndex: number, imageIndex: number, imageId: number, visible: boolean): void {
        this.conn.server.setTweetImageVisibility(imageId, this.streamEvent.Name, visible);
        this.activeTweets[tweetIndex].MediaList[imageIndex].Visible = visible;
    }

    removeActiveTweetFromDB(id: number): void {
        this.conn.server.removeTweet(id, this.streamEvent.Name);
    }

    getStreamStatus(): void {
        if (this.initialised) {
            this.conn.server.getStreamStatus(this.streamEvent.Name);
        }
    }

    banUser(tweet: Tweet): void {
        this.conn.server.banUser(tweet, this.streamEvent.Name);
    }

    removeBannedUser(userId: number) {
        this.conn.server.removeBannedUser(userId, this.streamEvent.Name);
    }
}