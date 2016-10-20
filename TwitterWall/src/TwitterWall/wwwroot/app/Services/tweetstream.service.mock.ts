import { Injectable } from "@angular/core";
import { Subject } from "rxjs/Subject";
import { Tweet } from "../Models/tweet";
import { Queue } from "../Models/queue";

import "rxjs/add/operator/toPromise";

export enum Action {
    Add,
    Remove
};

@Injectable()
export class TweetStreamMock {
    private conn: any;
    private tweetsQueue: Tweet[];
    private activeTweets: Tweet[];
    private queueChanged = new Subject<Tweet[]>();
    public queueEvent$ = this.queueChanged.asObservable();
    private activeQueueChanged = new Subject<Tweet[]>();
    public activeQueueEvent$ = this.activeQueueChanged.asObservable();
    activeQueueSize: number = 5;

    private tracks = new Subject<any[]>();
    public tracksReceived$ = this.tracks.asObservable();

    private users = new Subject<any[]>();
    public usersReceived$ = this.users.asObservable();


    private errorMessage = new Subject<string>();
    public errorMessageReceived$ = this.errorMessage.asObservable();


    constructor() {
        this.tweetsQueue = [];
        this.activeTweets = [];
        
    }

    getQueue(): Tweet[] {
        return this.tweetsQueue;
    }

    getActiveTweets(): Tweet[] {
        return this.activeTweets;
    }

    addActiveTweet(tweet: Tweet): boolean {
        if (tweet && this.activeTweets.length < this.activeQueueSize) {
            this.activeTweets.push(tweet);
            this.activeQueueChanged.next(this.activeTweets);
            return true;
        }
        return false;
    }

    removeActiveTweet(tweet: Tweet): boolean {
        let index = this.activeTweets.indexOf(tweet);
        if (index !== -1) {
            this.activeTweets.splice(index, 1);
            this.activeQueueChanged.next(this.activeTweets);
            return true;
        }
        return false;
    }

    popNextTweet(): Tweet {
        let tweet = this.tweetsQueue.shift();
        if (tweet) {
            this.queueChanged.next(this.tweetsQueue);
        }
        return tweet;
    }

    addTweet(tweet: Tweet): void {
        this.tweetsQueue.push(tweet);
        this.queueChanged.next(this.tweetsQueue);
    }

    removeTweet(tweet: Tweet): void {
        let index = this.tweetsQueue.indexOf(tweet);
        if (index !== -1) {
            this.tweetsQueue.splice(index, 1);
            this.queueChanged.next(this.tweetsQueue);
        }
    }

    removeActiveTweetFromDB(tweet: Tweet): void {
        let index = this.activeTweets.indexOf(tweet);
        if (index !== -1) {
            this.activeTweets.splice(index, 1);
            this.activeQueueChanged.next(this.activeTweets);
        }
    }

    removeTweetImage(tweetIndex: number, imageIndex: number, imageId: number): void {
        this.activeTweets[tweetIndex].MediaList.splice(imageIndex, 1);
        this.activeQueueChanged.next(this.activeTweets);
    }

    followTrack(keyword: string): void {
        let keywords: Array<{ Id: number, Value: string, Type: string }> = [];
        keywords.push({ Id: 1, Value: "", Type: "" });
        this.tracks.next(keywords);
    }

    getTracks(): void {
        this.tracks.next([]);
    }

    followUser(userId: string): void {
        let keywords: Array<{ Id: number, Value: string, Type: string }> = [];
        keywords.push({ Id: 1, Value: "", Type: "" });
        this.users.next(keywords);
    }

    getUsers(): void {
        this.users.next([]);
    }

    removeSubscription(id: number, type: string): void {
        if (type === "TRACK") {
            this.tracks.next([]);
        }
        else if (type === "PERSON") {
            this.users.next([]);
        }
    }

    isInitialised(): boolean {
        return true;
    }
}
