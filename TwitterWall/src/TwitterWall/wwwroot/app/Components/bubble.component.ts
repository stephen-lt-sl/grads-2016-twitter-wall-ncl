import { Component, OnInit, OnDestroy } from "@angular/core";
import * as vagueTime from "vague-time";
import { Vector } from "../Models/vector";
import { Tweet } from "../Models/tweet";
import { TweetStream } from "../Services/tweetstream.service";
import { Router, ActivatedRoute, Params } from "@angular/router";
import * as d3 from "d3";
import * as bubbleHelpers from "../Helpers/bubble-helpers";

const MAX_NODES = 20;
const MAX_RADIUS = 40;
const MIN_RADIUS = 10;
const INCREASE_STEP = 0.2;
const TIME_BETWEEN_EXPAND = 2000;
const TIME_TO_SHOW = 5000;
const TRANSLATION_TICKS = 100;
const GRAVITY = 0.01;
const DEFAULT_IMAGE = "https://pbs.twimg.com/media/CLIz5A9VAAAcbNe.png";

const GROW_TIME = 3400;
const TRANSLATE_TIME = 5000;
const EXIT_TIME = 2000;
const PAUSE_ON_VISIBILITY_CHANGE = true;

@Component({
    selector: "bubble-canvas",
    template: `
        <div id="bubble-canvas" [class.fullscreen]="fullScreen">
            <div class="bubble-groups">
              <div class="shadow-group"></div>
              <div class="content-group"></div>
            </div>
            <div id="brand">
                <img src="/img/bristech-black.png" />
                <span>#bristech2016</span>
            <div>
        </div>
    `
})
export class BubbleComponent implements OnInit, OnDestroy {
    context: any;
    width: number;
    height: number;
    nodes: any[] = [];
    root: any;
    force: any;
    displayTimer: any;
    displayPoint: Vector;
    showTweet = false;

    displayRadius: number;
    radius: number;
    stickyRadius: number;
    exitStartTime: number;
    pauseTime: number;

    resizeListener: EventListenerOrEventListenerObject;
    visibilitychangeListener: EventListenerOrEventListenerObject;

    displayCount: number = 0;

    eventName: string;

    constructor(private tweetStream: TweetStream, private router: Router, private route: ActivatedRoute) { }

    get stickyNodes(): any[] {
        return this.nodes.filter(n => n.tweet.Sticky);
    }

    ngOnInit(): void {
        this.route.params.forEach((params: Params) => {
            this.eventName = params["id"];
        });
        this.tweetStream.setEvent(this.eventName);

        let initialTweets = this.tweetStream
            .getActiveTweets()
            .map(this.instantiateTweet);

        this.onResize();
        this.populateNodes(initialTweets);
        this.setupForce();
        this.force.size([this.width, this.height]);

        this.force.start();
        this.updateNodes();

        this.tweetStream.activeQueueEvent$.subscribe(this.activeTweetsChanged.bind(this));
        this.tweetStream.deleteFromActiveQueueEvent$.subscribe(this.activeTweetDeleted.bind(this));

        this.nodeDisplayInterval();

        this.resizeListener = this.onResize.bind(this);
        this.visibilitychangeListener = this.onVisibilityChanged.bind(this);
        window.addEventListener("resize", this.resizeListener);
        window.addEventListener("visibilitychange", this.resizeListener);
    };

    getTweetRadius(tweet: Tweet): number {
        return tweet.Sticky ? this.stickyRadius : this.radius;
    }

    onVisibilityChanged(): void {
        if (!PAUSE_ON_VISIBILITY_CHANGE) {
            return;
        }
        if (document.hidden) {
            this.force.stop();
            this.pauseTime = Date.now();
        } else {
            const currentTime = Date.now();
            const timers = ["scaleStartTime", "translateStartTime", "exitStartTime"];
            this.force.resume();
            this.nodes.forEach(node => {
                timers.forEach(timer => {
                    if (node[timer]) {
                        node[timer] += currentTime - this.pauseTime;
                    }
                });
            });
            this.pauseTime = null;
        }
    }

    onResize(): void {
        this.width = document.body.offsetWidth;
        this.height = document.body.offsetHeight;
        this.displayPoint = new Vector(this.width / 2, this.height / 2);

        if (this.force) {
            this.force.size([this.width, this.height]);
        }

        this.displayRadius = this.width < this.height ? this.width * 0.35 : this.height * 0.35;
        this.radius = this.displayRadius * 0.3;
        this.stickyRadius = this.displayRadius * 0.5;

        this.nodes.forEach((node) => {
            if (!node.isDisplayed) {
                node.radius = this.getTweetRadius(node.tweet);
                node.opacity = 0;
            }
        });
        this.updateNodes();
    }

    ngOnDestroy(): void {
        this.force.stop();
        this.force = null;
        clearTimeout(this.displayTimer);
        this.nodes = null;
        window.removeEventListener("resize", this.resizeListener);
        window.removeEventListener("visibilitychange", this.resizeListener);
    }

    nodeDisplayInterval(): void {
        this.displayTimer = setTimeout(() => {
            this.displayNode();
            if (this.router.url === "/events/" + this.eventName) {
                this.nodeDisplayInterval();
            }
        }, TIME_BETWEEN_EXPAND);
    }

    activeTweetsChanged(rawTweets: Tweet[]): void {
        const activeTweets = rawTweets.map(this.instantiateTweet);
        if (!activeTweets || !this.nodes) return;

        if (activeTweets.length - this.nodes.length > 1) {
            activeTweets.forEach((tweet) => {
                this.addNode(0, 0, tweet);
            });
            return;
        }

        rawTweets.forEach((tweet, i) => {
            this.nodes.forEach(n => {
                if (n.tweet.TweetId === tweet.TweetId) {
                    n.tweet.MediaList = tweet.MediaList;
                    n.tweet.Sticky = tweet.Sticky;
                    if (!n.isDisplayed) {
                        n.radius = this.getTweetRadius(n.tweet);
                    }
                }
            });
        });

        if (activeTweets.length > this.nodes.length) {
            this.addNode(0, 0, activeTweets[activeTweets.length - 1]);
        }
    }

    activeTweetDeleted(tweet) {
        const toDelete = this.nodes.find((node) => (node.tweet.Id === tweet.Id));
        if (toDelete) {
            this.removeNode(toDelete.tweet.Id);
        }
    }

    renderTweetContent(tweet: Tweet) {
        const tweetTime = vagueTime.get({
            to: new Date(tweet.Date).getTime() + (new Date()).getTimezoneOffset() * 60 * 1000,
        });
        const tweetBody = tweet.Body
            .replace(/[A-Za-z]+:\/\/[A-Za-z0-9-_]+\.[A-Za-z0-9-_:%&~\?\/.=]+/g, "<span class='url'>$&</span>")
            .replace(/(@\S+)/g, "<span class='mention'>$&</span>")
            .replace(/(#\S+)/g, "<span class='hashtag'>$&</span>");

        return `
          <div class='tweet-header'>
            <img class="profile-image" src="${tweet.ProfileImage}"/>
            <div class="names-container">
              <h2 class="name">${tweet.Name}</h2>
              <h3 class="username">@${tweet.Handle}</h3>
            </div>
            <img class="twitter-logo" src="../../img/Twitter_Social_Icon_Blue.png">
          </div>
          <div class="tweet-body">${tweetBody}</div>
          <div class="attached-images">
            ${
            tweet.MediaList.filter(img => img.Visible).slice(0, 1).map(img => `<img src=${img.Url} />`).join("")
            }
          </div>
          <span class="timestamp">${tweetTime}</span>
        `;
    }

    updateNodes() {
        const shadowSelection: any = d3
            .select(".shadow-group")
            .selectAll(".bubble-shadow")
            .data<any>(this.nodes, (node) => node.tweet.Id);

        const bubbleSelection: any = d3
            .select(".content-group")
            .selectAll(".bubble-content")
            .data<any>(this.nodes, (node) => node.tweet.Id);

        const positionSelection = (selection) => {
            selection
                .style("transform", node => "translate3d(" +
                    ((node.fixed ? this.displayPoint.x : node.x) - node.radius) + "px, " +
                    ((node.fixed ? this.displayPoint.y : node.y) - node.radius) + "px, 0)"
                )
                .style("width", node => `${node.radius * 2}px`)
                .style("height", node => `${node.radius * 2}px`);
        };

        // Silky codez using translate3d(x, y, z) to force browser to use
        // hardware accelaration on bubbles
        shadowSelection
            .enter()
            .append("div")
            .attr("class", "bubble-shadow bubble")
            .style("box-shadow", node => {
                const offset = node.radius * 0.2;
                const blur = node.radius * 0.45;
                const spread = 0;
                const colour = "rgba(0, 0, 0, 0.25)";
                return `-${offset}px ${offset}px ${blur}px ${spread} ${colour}`;
            });

        const bubble = bubbleSelection
            .enter()
            .append("div")
            .attr("class", "bubble-content bubble");

        bubble
            .append("div")
            .attr("class", "bubble-image")
            .style("background-image", node => `url(${node.tweet.ProfileImage})`);

        const self = this;

        bubble
            .append("div")
            .attr("class", "bubble-tweet")
            .append("div")
            .attr("class", "tweet-content")
            .style("width", `${this.displayRadius * 2}px`)
            .style("height", `${this.displayRadius * 2}px`);

        bubbleSelection
            .selectAll(".tweet-content")
            .each(function (data, i) {
                this.innerHTML = self.renderTweetContent(data.tweet);
            });

        bubbleSelection
            .selectAll(".bubble-tweet")
            .style("opacity", node => node.tweet.Sticky ? 1 : node.opacity);

        bubbleSelection
            .selectAll(".tweet-content")
            .style("transform", (node) => `scale(${isNaN(node.scale) ? 1 : node.scale}`);

        positionSelection(shadowSelection);
        positionSelection(bubbleSelection);

        shadowSelection.exit().remove();
        bubbleSelection.exit().remove();
    }

    displayNode(): void {
        if (this.router.url === "/events/" + this.eventName &&
            this.nodes.every(n => !n.isDisplayed && !n.isTranslating) &&
            this.nodes &&
            this.nodes.length
        ) {
            const i = this.displayCount % this.nodes.length;
            const node = this.nodes[i];
            node.isTranslating = true;
            this.displayCount = (this.displayCount + 1) % this.nodes.length;
            node.translateStartTime = Date.now();
            node.translateStartPoint = {
                x: node.x,
                y: node.y
            };
        }
    }

    populateNodes(tweets): void {
        if (tweets) {
            this.nodes = d3
                .range(tweets.length)
                .map((d, i) => ({
                    tweet: tweets[i],
                    radius: this.getTweetRadius(tweets[i]),
                    scale: this.getTweetRadius(tweets[i]) / this.displayRadius,
                    isDisplayed: false,
                    isTranslating: false,
                    isIncreasing: false,
                    isDecreasing: false,
                    isDeleting: false,
                    opacity: 0
                }));
        }
    };

    setupForce(): void {
        this.force = d3.layout.force()
            .gravity(GRAVITY)
            .friction(0.85)
            .charge(-80)
            .nodes(this.nodes)
            .size([this.width, this.height]);
        this.force.on("tick", this.tick.bind(this));
    };

    translateBubble(node: any): void {
        const GROW_ZONE = 100;

        if (bubbleHelpers.almostEqual(node.x, this.displayPoint.x) &&
            bubbleHelpers.almostEqual(node.y, this.displayPoint.y)
        ) {
            node.isTranslating = false;
            node.isDisplayed = true;
            node.isIncreasing = true;
            node.fixed = true;
        }
        else {
            const valueX = bubbleHelpers.easeOut(
                Date.now() - node.translateStartTime, node.translateStartPoint.x,
                this.displayPoint.x - node.translateStartPoint.x, TRANSLATE_TIME
            );
            const valueY = bubbleHelpers.easeOut(
                Date.now() - node.translateStartTime, node.translateStartPoint.y,
                this.displayPoint.y - node.translateStartPoint.y, TRANSLATE_TIME
            );

            node.x = valueX;
            node.y = valueY;
        }

        if (!node.isIncreasing &&
            bubbleHelpers.almostEqual(node.x, this.displayPoint.x, GROW_ZONE) &&
            bubbleHelpers.almostEqual(node.y, this.displayPoint.y, GROW_ZONE)
        ) {
            node.isDisplayed = true;
            node.isIncreasing = true;
            node.scaleStartTime = Date.now();
        }
    };

    instantiateTweet(tweet: Tweet) {
        return new Tweet(
            tweet.Id, tweet.TweetId, tweet.Body, tweet.Handle,
            new Date(tweet.Date as any).toString(), tweet.Name, tweet.ProfileImage,
            tweet.MediaList, tweet.Sticky
        );
    }

    addNode(x: number = 0, y: number = 0, tweet: Tweet): void {
        if (tweet !== undefined && !this.nodes.find(t => t.tweet.Id === tweet.Id)) {
            this.nodes.push({
                x: x,
                y: y,
                tweet: tweet,
                radius: this.getTweetRadius(tweet),
                scale: this.getTweetRadius(tweet) / this.displayRadius,
                opacity: 0
            });
            this.force.start();
        }
    };

    removeNode(id: number): void {
        const node = this.nodes.find((node) => (node.tweet.Id === id));
        if (node && !node.isDeleting) {
            if (!node.isDisplayed && !node.isTranslating) {
                node.exitStartTime = Date.now();
                node.isDeleting = true;
                node.toBeDeleted = false;
            }
            else {
                node.toBeDeleted = true;
                node.isDeleting = false;
            }
        }
    };

    private deleteNode(index: number): void {
        this.nodes.splice(index, 1);
        this.force.resume();
    };

    tick(): void {
        let i;
        let d;
        let n = this.nodes.length;

        for (i = 0; i < n; ++i) {
            d = this.nodes[i];
            const initialRadius = this.getTweetRadius(d.tweet);

            if (d.isIncreasing) {
                bubbleHelpers.growBubble(
                    d, TIME_TO_SHOW, GROW_TIME, initialRadius,
                    this.displayRadius, this
                );
            }
            else if (d.isDecreasing && !d.isTranslating) {
                bubbleHelpers.shrinkBubble(
                    d, d.scaleStartTime, GROW_TIME, initialRadius, this.displayRadius,
                    initialRadius / this.displayRadius, 1
                );
            }

            if (d.isTranslating) {
                this.translateBubble(d);
            }

            if (d.isDeleting) {
                bubbleHelpers.shrinkBubble(
                    d, d.exitStartTime, EXIT_TIME, 0, initialRadius, 0,
                    initialRadius / this.displayRadius, false
                );
                if (d.radius < 1) {
                    d.deleted = true;
                }
            }

            if (d.toBeDeleted && !d.isDisplayed) {
                this.removeNode(d.tweet.Id);
            }

            bubbleHelpers.collide(this.nodes);
        }

        for (i = 0; i < n; i++) {
            if (this.nodes[i].deleted) {
                this.deleteNode(i);
                break;
            }
        }

        this.updateNodes();
        this.force.resume();
    };

    end() {
        this.force.start();
    }
};