import { Component } from "@angular/core";
import { Tweet } from "../Models/tweet";
import { TweetStream } from "../Services/tweetstream.service";
import * as moment from "moment";

@Component({
    selector: "active-tweets",
    template: `
        <div class="table-responsive">
            <table class="table table-condensed">
                <tbody>
                    <tr>
                      <th>Body</th>
                      <th>User</th>
                      <th>Date</th>
                      <th>Profile Image</th>
                      <th>Attached Images</th>
                      <th>Sticky</th>
                    </tr>
                    <tr *ngFor="let tweet of activeTweets; let i=index">
                        <td>
                            {{tweet.Body}}
                        </td>
                        <td>
                            <div>{{tweet.Name}}</div>
                            <div>@{{tweet.Handle}}</div>
                        </td>
                        <td>
                    {{tweet.FormattedDate}}
                        </td>
                        <td>
                            <img class="profile-image" src="{{tweet.ProfileImage}}"/>
                        </td>
                        <td>
                            <div class="images-container">
                                <img [ngClass]="{'deleted-small-img': !img.Visible}" (click)="setImageVisibility(i, imgIndex, img.Id, !img.Visible)" class="small-img" *ngFor="let img of tweet.MediaList; let imgIndex=index" src="{{img.Url}}"/>
                            </div>
                        </td>
                        <td>
                            <input type="checkbox" [attr.checked]="isSticky(i) ? true : null" (click)=sticky(i,$event)>
                        </td>
                        <td>
                            <a class="text-warning" (click)="removeTweet(tweet.Id)">Remove Tweet</a>&nbsp;
                            <a class="text-danger" (click)="this.banUser(tweet)">Ban user</a>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        `
})
export class ActiveTweets {
    activeTweets: Tweet[] = [];
    constructor(private tweetStream: TweetStream) {
        this.activeTweets = this.tweetStream.getActiveTweets().map(this.mapTweet);
        this.tweetStream.activeQueueEvent$.subscribe((tweets) => {
            this.activeTweets = tweets.map(this.mapTweet);
        });
    }

    mapTweet(tweet: Tweet): Tweet {
        return Object.assign(tweet,
            {
                FormattedDate: moment(tweet.Date).format("Do MMM, h:mm a")
            });
    }

    isSticky(index: number): boolean {
        return this.activeTweets[index].Sticky;
    }

    removeTweet(id: number): void {
        this.tweetStream.removeActiveTweetFromDB(id);
    }

    addTweet(tweet: Tweet): void {
        this.tweetStream.addActiveTweet(tweet);
    }

    sticky(index: number, event: any): void {
        this.tweetStream.toggleSticky(this.activeTweets[index].Id);
    }

    setImageVisibility(tweetIndex: number, imageIndex: number, imageId: number, visible: boolean): void {
        this.tweetStream.setTweetImageVisibility(tweetIndex, imageIndex, imageId, visible);
    }

    banUser(tweet) {
        this.tweetStream.banUser(tweet);
    }
}