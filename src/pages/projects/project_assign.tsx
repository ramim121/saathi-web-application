import type { GetServerSidePropsContext } from 'next';

/** The two assignment forms are now one page; this keeps old links working. */
export default function ProjectAssign() {
    return null;
}

export function getServerSideProps(context: GetServerSidePropsContext) {
    const project = Number(context.query.project);
    return {
        redirect: {
            destination: project > 0 ? `/projects/partner_assign?project=${project}` : '/projects/partner_assign',
            permanent: false,
        },
    };
}
