import { Injectable } from "@angular/core";
import { Subject } from "rxjs/Subject";
import { Tweet } from "../Models/tweet";
import { Queue } from "../Models/queue";
import { Subscription } from "../Models/subscription";

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

    private bannedUsers = new Subject<any[]>();
    public bannedUsersReceived$ = this.bannedUsers.asObservable();

    private deleteFromActiveQueue = new Subject<Tweet>();
    public deleteFromActiveQueueEvent$ = this.deleteFromActiveQueue.asObservable();

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
            this.deleteFromActiveQueue.next(tweet);
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

    removeActiveTweetFromDB(id: number): void {
        let tweet = this.activeTweets.find(t => t.Id === id);
        if (tweet) {
            this.activeTweets.splice(this.activeTweets.indexOf(tweet), 1);
            this.activeQueueChanged.next(this.activeTweets);
        }
    }

    setTweetImageVisibility(tweetIndex: number, imageIndex: number, imageId: number, visible: boolean): void {
        this.activeTweets[tweetIndex].MediaList[imageIndex].Visible = visible;
        this.activeQueueChanged.next(this.activeTweets);
    }

    addTrack(keyword: string): void {
        let keywords = Array<Subscription>();
        keywords.push({ Id: 1, Value: "", Type: "" });
        this.tracks.next(keywords);
    }

    getTracks(): void {
        this.tracks.next([]);
    }

    followUser(userId: string): void {
        let keywords = Array<Subscription>();
        keywords.push({ Id: 1, Value: "", Type: "" });
        this.users.next(keywords);
    }

    getPriorityUsers(): void {
        this.users.next([]);
    }

    removeTrack(): void {
        this.tracks.next([]);
    }

    isInitialised(): boolean {
        return true;
    }

    setEvent(ev: string) {
    }

    initialise(): void {
    }

    getBannedUsers(): void {
        this.bannedUsers.next([]);
    }

    banUser(handle: string): void {
        this.bannedUsers.next([handle]);
    }

    removeBannedUser(userId: number) {
        this.bannedUsers.next([]);
    }
}