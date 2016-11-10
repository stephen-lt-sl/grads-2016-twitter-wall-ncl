export class MediaUrl {
    public Id: number;
    public Url: string;
    public Visible: boolean;

    constructor(id: number, url: string, visible: boolean) {
        this.Id = id;
        this.Url = url;
        this.Visible = visible;
    }
}
